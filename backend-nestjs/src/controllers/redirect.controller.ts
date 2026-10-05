import { Controller, Get, Param, Req, Res, Headers } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service.js';
import { DatabaseService } from '../db/database.service.js';
import { LinkService } from '../services/link.service.js';
import { TemplateService } from '../services/template.service.js';
import { CachedLink } from '../types/index.js';
import {
  ErrorCodes,
  JobNames,
  LinkStatus,
  QueueNames,
  REDIS_KEYS,
  SYSTEM_ROUTES,
  TenantStatus,
} from '../constants/index.js';
import { env } from '../config/env.js';

const RESERVED_PATHS = new Set(['api', 'system', 'admin', 'auth', 'dashboard']);
const isReservedPath = (path: string) => RESERVED_PATHS.has(path.toLowerCase());

@Controller()
export class RedirectController {
  constructor(
    private readonly redis: RedisService,
    private readonly db: DatabaseService,
    @InjectQueue(QueueNames.CLICKS) private readonly clicksQueue: Queue
  ) {}

  @Get(SYSTEM_ROUTES.EXPIRED)
  getExpired(@Res() reply: FastifyReply) {
    const html = TemplateService.render('expired', {
      title: 'Link Expired',
      message: 'This link has expired or reached its maximum usage limit. Please contact the sender for an updated link.',
    });
    return reply.type('text/html').send(html);
  }

  @Get(SYSTEM_ROUTES.UNAVAILABLE)
  getUnavailable(@Res() reply: FastifyReply) {
    const html = TemplateService.render('unavailable', {
      title: 'Link Unavailable',
      message: 'This link is currently inactive, suspended, or under administrative review. Please try again later.',
    });
    return reply.type('text/html').send(html);
  }

  @Get(':code')
  async handleShortCode(
    @Param('code') code: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Headers('x-forwarded-host') forwardedHost?: string
  ) {
    if (isReservedPath(code)) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const rawHost = (forwardedHost || req.hostname || '').split(':')[0].toLowerCase().replace(/^www\./, '');
    const domain = await this.redis.getDomainByHostname(rawHost);
    const domainId =
      domain?.id ||
      (rawHost === 'localhost' || rawHost === '127.0.0.1' || rawHost.startsWith('192.168.')
        ? env.DEFAULT_DOMAIN_ID
        : undefined);
    if (!domainId) {
      return reply.status(404).send({ error: 'Domain not registered' });
    }
    const now = Date.now();

    let link: CachedLink | null = await this.redis.getCachedLink(domainId, code);

    if (!link) {
      const res = await this.db.pool.query(
        `SELECT id, tenant_id, destination_url, redirect_type, status, expires_at, max_clicks, click_count
         FROM links
         WHERE domain_id = $1 AND (short_code = $2 OR LOWER(alias) = LOWER($2))`,
        [domainId, code]
      );

      if (res.rowCount === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCodes.NOT_FOUND, message: 'Short link does not exist' },
        });
      }

      link = LinkService.toCachedLink(res.rows[0]);
      await this.redis.setCachedLink(domainId, code, link);
    }

    const tenantStatus = await this.redis.getTenantStatus(link.tenantId);
    if (tenantStatus === TenantStatus.SUSPENDED || tenantStatus === TenantStatus.ARCHIVED) {
      return reply.status(302).redirect(SYSTEM_ROUTES.UNAVAILABLE);
    }

    if (link!.status === LinkStatus.EXPIRED) {
      return reply.status(302).redirect(SYSTEM_ROUTES.EXPIRED);
    }
    if (link!.status !== LinkStatus.ACTIVE) {
      return reply.status(302).redirect(SYSTEM_ROUTES.UNAVAILABLE);
    }
    if (link!.expiresAt && link!.expiresAt < now) {
      return reply.status(302).redirect(SYSTEM_ROUTES.EXPIRED);
    }

    if (link!.maxClicks) {
      const clickCounterKey = REDIS_KEYS.LINK_CLICKS(domainId, code);
      let totalClicks = await this.redis.client.incr(clickCounterKey);
      
      if (totalClicks === 1) {
        if (link!.currentClicks > 0) {
          await this.redis.client.incrby(clickCounterKey, link!.currentClicks);
          totalClicks += link!.currentClicks;
        }

        let ttl = env.CACHE_LINK_TTL_SEC;
        if (link!.expiresAt) {
          const secondsRemaining = Math.ceil((link!.expiresAt - now) / 1000);
          if (secondsRemaining > 0) {
            ttl = Math.min(ttl, secondsRemaining);
          }
        }
        await this.redis.client.expire(clickCounterKey, Math.max(ttl, 60));
      }

      if (totalClicks > link!.maxClicks) {
        return reply.status(302).redirect(SYSTEM_ROUTES.EXPIRED);
      }
    }

    const geoUa = (req as any).geoUa || (req.raw as any)?.geoUa || {
      clientIp: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || '127.0.0.1',
      userAgent: (req.headers['user-agent'] as string) || 'Unknown',
      referrer: (req.headers['referer'] as string) || undefined,
      countryCode: (req.headers['cf-ipcountry'] as string) || undefined,
    };
    this.clicksQueue
      .add(JobNames.INGEST_CLICK, {
        linkId: link!.id,
        tenantId: link!.tenantId,
        domainId,
        clickedAt: new Date().toISOString(),
        ip: geoUa.clientIp,
        userAgent: geoUa.userAgent,
        referrer: geoUa.referrer,
        countryCode: geoUa.countryCode,
      })
      .catch(() => {});

    const statusCode = link!.redirectType === 307 ? 307 : 302;
    return reply.status(statusCode).redirect(link!.destinationUrl);
  }

  @Get(':tenantCode/:alias')
  async handleAlias(
    @Param('tenantCode') tenantCode: string,
    @Param('alias') alias: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    if (isReservedPath(tenantCode)) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const tenantCodeKey = `tenant:code:${tenantCode.toLowerCase()}`;
    let tenantId = await this.redis.client.get(tenantCodeKey);

    if (!tenantId) {
      const res = await this.db.pool.query(
        `SELECT id, status FROM tenants WHERE code = $1`,
        [tenantCode.toLowerCase()]
      );
      if (res.rowCount === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCodes.NOT_FOUND, message: 'Tenant does not exist' },
        });
      }
      tenantId = res.rows[0].id;
      await this.redis.client.setex(tenantCodeKey, 86400, tenantId!);
      
      if (res.rows[0].status === TenantStatus.SUSPENDED || res.rows[0].status === TenantStatus.ARCHIVED) {
        return reply.status(302).redirect(SYSTEM_ROUTES.UNAVAILABLE);
      }
    } else {
      const tenantStatus = await this.redis.getTenantStatus(tenantId);
      if (tenantStatus === TenantStatus.SUSPENDED || tenantStatus === TenantStatus.ARCHIVED) {
        return reply.status(302).redirect(SYSTEM_ROUTES.UNAVAILABLE);
      }
    }

    const aliasKey = REDIS_KEYS.ALIAS(tenantId!, alias.toLowerCase());
    let rawCachedLink = await this.redis.client.get(aliasKey);
    let link: CachedLink | null = null;
    const now = Date.now();

    if (rawCachedLink) {
      link = JSON.parse(rawCachedLink);
    } else {
      const res = await this.db.pool.query(
        `SELECT l.id, l.domain_id, l.tenant_id, l.destination_url, l.redirect_type, l.status, l.expires_at, l.max_clicks, l.click_count
         FROM links l
         WHERE l.tenant_id = $1 AND l.alias = $2`,
        [tenantId, alias.toLowerCase()]
      );

      if (res.rowCount === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCodes.NOT_FOUND, message: 'Alias link does not exist' },
        });
      }

      link = LinkService.toCachedLink(res.rows[0]);
      await this.redis.client.setex(aliasKey, env.CACHE_LINK_TTL_SEC, JSON.stringify(link));
    }

    if (link!.status === LinkStatus.EXPIRED) {
      return reply.status(302).redirect(SYSTEM_ROUTES.EXPIRED);
    }
    if (link!.status !== LinkStatus.ACTIVE) {
      return reply.status(302).redirect(SYSTEM_ROUTES.UNAVAILABLE);
    }
    if (link!.expiresAt && link!.expiresAt < now) {
      return reply.status(302).redirect(SYSTEM_ROUTES.EXPIRED);
    }

    if (link!.maxClicks) {
      const clickCounterKey = `alias_clicks:${tenantId}:${alias.toLowerCase()}`;
      let totalClicks = await this.redis.client.incr(clickCounterKey);
      
      if (totalClicks === 1) {
        if (link!.currentClicks > 0) {
          await this.redis.client.incrby(clickCounterKey, link!.currentClicks);
          totalClicks += link!.currentClicks;
        }

        let ttl = env.CACHE_LINK_TTL_SEC;
        if (link!.expiresAt) {
          const secondsRemaining = Math.ceil((link!.expiresAt - now) / 1000);
          if (secondsRemaining > 0) {
            ttl = Math.min(ttl, secondsRemaining);
          }
        }
        await this.redis.client.expire(clickCounterKey, Math.max(ttl, 60));
      }

      if (totalClicks > link!.maxClicks) {
        return reply.status(302).redirect(SYSTEM_ROUTES.EXPIRED);
      }
    }

    const geoUa = (req as any).geoUa || (req.raw as any)?.geoUa || {
      clientIp: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || '127.0.0.1',
      userAgent: (req.headers['user-agent'] as string) || 'Unknown',
      referrer: (req.headers['referer'] as string) || undefined,
      countryCode: (req.headers['cf-ipcountry'] as string) || undefined,
    };
    this.clicksQueue
      .add(JobNames.INGEST_CLICK, {
        linkId: link!.id,
        tenantId: link!.tenantId,
        domainId: link!.domainId,
        clickedAt: new Date().toISOString(),
        ip: geoUa.clientIp,
        userAgent: geoUa.userAgent,
        referrer: geoUa.referrer,
        countryCode: geoUa.countryCode,
      })
      .catch(() => {});

    const statusCode = link!.redirectType === 307 ? 307 : 302;
    return reply.status(statusCode).redirect(link!.destinationUrl);
  }
}
