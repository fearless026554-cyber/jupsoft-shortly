import { Controller, Get, Post, Patch, Delete, Param, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { LinkService } from '../services/link.service.js';
import { parseCsvLinks } from '../utils/csv.util.js';
import { QrService } from '../services/qr.service.js';
import { AuditService } from '../services/audit.service.js';
import { UrlService } from '../services/url.service.js';
import { ScreeningService } from '../services/screening.service.js';
import { getGeoUa } from '../common/middleware/geo-ua.middleware.js';
import { AuthGuard, RequireScope, Public } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { env } from '../config/env.js';
import {
  ApiScopes,
  BULK_CONSTANTS,
  BULK_LIMITS,
  ErrorCodes,
  FALLBACKS,
  JobNames,
  LINK_LIMITS,
  LinkStatus,
  PAGINATION,
  PATCHABLE_LINK_STATUSES,
  QR_CONSTANTS,
  QR_FORMATS,
  REDIRECT_TYPES,
  RedirectType,
  ScreeningProvider,
  ScreeningVerdict,
  QueueNames,
  QueueRetryOptions,
  UserRoles,
} from '../constants/index.js';

const createLinkSchema = z.object({
  destinationUrl: z.string().url('Must be a valid URL'),
  alias: z.string().max(LINK_LIMITS.MAX_ALIAS_LEN).optional(),
  domainId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  maxClicks: z.number().int().positive().optional(),
  tag: z.string().max(LINK_LIMITS.MAX_TAG_LEN).optional(),
  externalRef: z.string().max(LINK_LIMITS.MAX_EXTERNAL_REF_LEN).optional(),
  redirectType: z.enum(REDIRECT_TYPES).default(String(FALLBACKS.REDIRECT_TYPE) as RedirectType),
});

const patchLinkSchema = z.object({
  destinationUrl: z.string().url().optional(),
  status: z.enum(PATCHABLE_LINK_STATUSES).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
  tag: z.string().max(LINK_LIMITS.MAX_TAG_LEN).nullable().optional(),
  alias: z.string().max(LINK_LIMITS.MAX_ALIAS_LEN).nullable().optional(),
});

const bulkCreateSchema = z.object({
  domainId: z.string().uuid().optional(),
  links: z
    .array(
      z.object({
        destinationUrl: z.string().url(),
        alias: z.string().optional(),
        domainId: z.string().uuid().optional(),
        tag: z.string().optional(),
        externalRef: z.string().optional(),
        expiresAt: z.string().datetime().optional(),
      })
    )
    .optional(),
  csvContent: z.string().max(5 * 1024 * 1024, 'CSV content must not exceed 5MB').optional(),
});



@Controller('api/v1/links')
@UseGuards(AuthGuard)
export class LinksController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    @InjectQueue(QueueNames.URL_SCREENING) private readonly screeningQueue: Queue,
    @InjectQueue(QueueNames.BULK_LINKS) private readonly bulkQueue: Queue
  ) {}

  @Post()
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async createLink(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = createLinkSchema.parse(req.body);
    const auth = (req as any).auth;
    const geoUa = getGeoUa(req);
    const tenantId = auth.tenantId;
    let domainId: string = dto.domainId || env.DEFAULT_DOMAIN_ID;
    if (!dto.domainId) {
      const tenantDomRes = await this.db.pool.query(
        `SELECT id FROM domains
         WHERE tenant_id = $1 OR tenant_id IS NULL
         ORDER BY (verification_status = 'verified') DESC, (tenant_id IS NOT NULL) DESC, created_at ASC
         LIMIT 1`,
        [tenantId]
      );
      domainId = tenantDomRes.rows[0]?.id || env.DEFAULT_DOMAIN_ID;
    } else if (dto.domainId !== env.DEFAULT_DOMAIN_ID) {
      const domRes = await this.db.pool.query(
        'SELECT id FROM domains WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
        [dto.domainId, tenantId]
      );
      if (domRes.rowCount === 0) {
        return reply.status(403).send({
          success: false,
          error: { code: ErrorCodes.FORBIDDEN, message: 'Domain does not belong to your organization' },
        });
      }
    }

    const result = await this.db.withTenantContext(tenantId, async (client) => {
      const created = await LinkService.createLink(client, tenantId, dto, domainId);
      await AuditService.log(client, {
        tenantId,
        actorId: auth.keyId,
        actorType: 'api_key',
        action: 'link.create',
        entity: 'links',
        entityId: created.link.id,
        afterState: { shortCode: created.link.shortCode, destinationUrl: created.link.destinationUrl },
        ipAddress: geoUa.clientIp,
      });
      return created;
    });

    const linkRow = result.link as any;
    const actualCode = linkRow.short_code || linkRow.shortCode;
    const cached = LinkService.toCachedLink(result.link);
    await this.redis.setCachedLink(domainId, actualCode, cached);

    this.screeningQueue
      .add(
        JobNames.SCREEN_URL,
        {
          linkId: linkRow.id,
          destinationUrl: linkRow.destination_url || linkRow.destinationUrl || dto.destinationUrl,
        },
        QueueRetryOptions.SCREENING
      )
      .catch(() => {});

    return reply.status(201).send({
      success: true,
      data: {
        id: linkRow.id,
        shortCode: actualCode,
        short_code: actualCode,
        shortUrl: result.shortUrl,
        aliasUrl: result.aliasUrl,
        destinationUrl: linkRow.destination_url || linkRow.destinationUrl,
        destination_url: linkRow.destination_url || linkRow.destinationUrl,
        qrCode: {
          svg: result.qrSvg,
          pngUrl: UrlService.buildQrUrl(linkRow.id, 'png'),
        },
        status: linkRow.status,
        expiresAt: linkRow.expires_at || linkRow.expiresAt,
        externalRef: linkRow.external_ref || linkRow.externalRef,
        createdAt: linkRow.created_at || linkRow.createdAt,
      },
    });
  }

  @Post('bulk')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async bulkCreate(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = bulkCreateSchema.parse(req.body);
    let items = dto.links || [];

    if (dto.csvContent) {
      const parsed = parseCsvLinks(dto.csvContent);
      items = [...items, ...parsed];
    }

    if (items.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCodes.INVALID_INPUT, message: 'No valid links or CSV content provided' },
      });
    }

    if (items.length > BULK_LIMITS.MAX_BATCH_SIZE) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCodes.LIMIT_EXCEEDED, message: `Batch size exceeds maximum limit of ${BULK_LIMITS.MAX_BATCH_SIZE} links` },
      });
    }

    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const defaultDomainId = dto.domainId || env.DEFAULT_DOMAIN_ID;

    const domainIdsToCheck = new Set<string>();
    if (dto.domainId && dto.domainId !== env.DEFAULT_DOMAIN_ID) {
      domainIdsToCheck.add(dto.domainId);
    }
    for (const item of items) {
      if (item.domainId && item.domainId !== env.DEFAULT_DOMAIN_ID) {
        domainIdsToCheck.add(item.domainId);
      }
    }

    if (domainIdsToCheck.size > 0) {
      const ids = Array.from(domainIdsToCheck);
      const domRes = await this.db.pool.query(
        'SELECT id FROM domains WHERE id = ANY($1::uuid[]) AND (tenant_id = $2 OR tenant_id IS NULL)',
        [ids, tenantId]
      );
      if (domRes.rowCount !== ids.length) {
        return reply.status(403).send({
          success: false,
          error: { code: ErrorCodes.FORBIDDEN, message: 'One or more specified domains do not belong to your organization' },
        });
      }
    }

    const jobId = `bulk_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const job = await this.bulkQueue.add(
      JobNames.PROCESS_BULK_LINKS,
      { jobId, tenantId, domainId: defaultDomainId, links: items },
      { jobId, ...QueueRetryOptions.BULK }
    );

    return reply.status(202).send({
      success: true,
      data: {
        jobId: job.id,
        totalCount: items.length,
        status: 'queued',
        statusEndpoint: UrlService.buildBulkStatusUrl(job.id!),
      },
    });
  }

  @Get('bulk/:jobId')
  @RequireScope(ApiScopes.LINKS_READ)
  async checkBulkStatus(
    @Param('jobId') jobId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const auth = (req as any).auth;
    const isSuperAdmin =
      auth?.role === UserRoles.SUPER_ADMIN ||
      auth?.scopes?.includes(ApiScopes.SUPER_ADMIN) ||
      auth?.scopes?.includes(ApiScopes.WILDCARD);
    const tenantId = auth?.tenantId;

    const job = await this.bulkQueue.getJob(jobId);
    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Bulk job not found' },
      });
    }

    if (!isSuperAdmin && job.data?.tenantId && job.data.tenantId !== tenantId) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Bulk job not found' },
      });
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;

    return reply.send({
      success: true,
      data: { jobId, status: state, progress: progress || 0, result: result || null },
    });
  }

  @Post(':id/clone')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async cloneLink(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const geoUa = getGeoUa(req);

    const result = await this.db.withTenantContext(tenantId, async (client) => {
      const currentRes = await client.query('SELECT * FROM links WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      if (currentRes.rowCount === 0) return null;
      const current = currentRes.rows[0];

      const created = await LinkService.createLink(
        client,
        tenantId,
        {
          destinationUrl: current.destination_url,
          tag: current.tag ? `${current.tag}${BULK_CONSTANTS.CLONE_TAG_SUFFIX}` : BULK_CONSTANTS.CLONE_DEFAULT_TAG,
          expiresAt: current.expires_at ? current.expires_at.toISOString() : undefined,
          maxClicks: current.max_clicks,
          redirectType: current.redirect_type,
        },
        current.domain_id
      );

      await AuditService.log(client, {
        tenantId,
        actorId: auth.keyId,
        actorType: 'api_key',
        action: 'link.clone',
        entity: 'links',
        entityId: created.link.id,
        beforeState: { sourceLinkId: id, shortCode: current.short_code },
        afterState: { shortCode: created.link.shortCode, destinationUrl: created.link.destinationUrl },
        ipAddress: geoUa.clientIp,
      });

      return created;
    });

    if (!result) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    const linkRow = result.link as any;
    const actualCode = linkRow.short_code || linkRow.shortCode;
    const cached = LinkService.toCachedLink(result.link);
    await this.redis.setCachedLink(linkRow.domain_id || result.link.domainId, actualCode, cached);

    this.screeningQueue.add(JobNames.SCREEN_URL, {
      linkId: linkRow.id,
      destinationUrl: linkRow.destination_url || linkRow.destinationUrl,
    }).catch(() => {});

    return reply.status(201).send({
      success: true,
      data: {
        id: linkRow.id,
        shortCode: actualCode,
        short_code: actualCode,
        shortUrl: result.shortUrl,
        destinationUrl: linkRow.destination_url || linkRow.destinationUrl,
        destination_url: linkRow.destination_url || linkRow.destinationUrl,
        createdAt: linkRow.created_at || linkRow.createdAt,
      },
    });
  }

  @Get()
  @RequireScope(ApiScopes.LINKS_READ)
  async listLinks(
    @Query('limit') limitStr: string,
    @Query('cursor') cursor: string,
    @Query('tenantId') queryTenantId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const auth = (req as any).auth;
    const isSuperAdmin = auth.role === 'super_admin' || auth.scopes?.includes('*');
    const limit = Math.min(Number(limitStr) || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);

    let targetTenantId: string | undefined;
    if (isSuperAdmin) {
      if (queryTenantId && queryTenantId !== 'all') {
        targetTenantId = queryTenantId;
      } else {
        targetTenantId = undefined;
      }
    } else {
      targetTenantId = auth.tenantId;
    }

    const runQuery = async (client: any) => {
      let query = `SELECT * FROM links`;
      const params: any[] = [];
      const conditions: string[] = [];

      if (targetTenantId) {
        params.push(targetTenantId);
        conditions.push(`tenant_id = $${params.length}`);
      }

      if (cursor) {
        params.push(new Date(cursor));
        conditions.push(`created_at < $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }

      params.push(limit);
      query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

      const res = await client.query(query, params);
      return res.rows;
    };

    const links = isSuperAdmin && !targetTenantId
      ? await this.db.withSuperAdminContext(runQuery)
      : await this.db.withTenantContext(targetTenantId || auth.tenantId, runQuery);

    return reply.send({
      success: true,
      data: {
        items: links.map((l: any) => ({ ...l, shortUrl: UrlService.buildShortUrl(l.short_code) })),
        nextCursor: links.length === limit ? links[links.length - 1].created_at : null,
      },
    });
  }

  @Get(':id')
  @RequireScope(ApiScopes.LINKS_READ)
  async getLink(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const isSuperAdmin = auth.role === 'super_admin' || auth.scopes?.includes('*');
    const tenantId = auth.tenantId;

    const cacheKey = `link:detail:${tenantId || 'global'}:${id}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const link = isSuperAdmin
      ? await this.db.withSuperAdminContext(async (client) => {
          const res = await client.query('SELECT * FROM links WHERE id = $1', [id]);
          return res.rows[0];
        })
      : await this.db.withTenantContext(tenantId, async (client) => {
          const res = await client.query('SELECT * FROM links WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
          return res.rows[0];
        });

    if (!link) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    const responseData = { ...link, shortUrl: UrlService.buildShortUrl(link.short_code) };
    await this.redis.client.setex(cacheKey, 120, JSON.stringify(responseData));

    return reply.send({ success: true, data: responseData });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async updateLink(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = patchLinkSchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const geoUa = getGeoUa(req);

    let previousAlias: string | null = null;
    let previousShortCode: string | null = null;
    const updated = await this.db.withTenantContext(tenantId, async (client) => {
      const currentRes = await client.query('SELECT * FROM links WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      if (currentRes.rowCount === 0) return null;
      const current = currentRes.rows[0];
      previousAlias = current.alias;
      previousShortCode = current.short_code;

      const destinationUrl = dto.destinationUrl ?? current.destination_url;
      const status = dto.status ?? current.status;
      const expiresAt = dto.expiresAt !== undefined ? (dto.expiresAt ? new Date(dto.expiresAt) : null) : current.expires_at;
      const maxClicks = dto.maxClicks !== undefined ? dto.maxClicks : current.max_clicks;
      const tag = dto.tag !== undefined ? dto.tag : current.tag;

      let newAlias = current.alias;
      let newShortCode = current.short_code;

      if (dto.alias !== undefined) {
        if (dto.alias && dto.alias.trim()) {
          let sanitized: string;
          try {
            sanitized = LinkService.sanitizeAlias(dto.alias);
          } catch (err: any) {
            const badReq: any = new Error(err.message || 'Invalid alias');
            badReq.statusCode = 400;
            badReq.code = ErrorCodes.VALIDATION_ERROR;
            throw badReq;
          }

          // Check if alias / short code is already taken on this domain OR for this tenant (excluding this link)
          const existing = await client.query(
            `SELECT id FROM links 
             WHERE ((domain_id = $1 AND (short_code = $2 OR LOWER(alias) = LOWER($2)))
                OR (tenant_id = $3 AND (short_code = $2 OR LOWER(alias) = LOWER($2))))
               AND id != $4
             LIMIT 1`,
            [current.domain_id, sanitized, tenantId, id]
          );
          if (existing.rowCount && existing.rowCount > 0) {
            const conflictErr: any = new Error(`Alias '${sanitized}' is already in use. Please choose a different alias.`);
            conflictErr.statusCode = 409;
            conflictErr.code = 'ALIAS_CONFLICT';
            throw conflictErr;
          }

          newAlias = sanitized;
          newShortCode = sanitized;
        } else {
          newAlias = null;
        }
      }

      if (dto.destinationUrl && dto.destinationUrl !== current.destination_url) {
        const screening = ScreeningService.validateDestinationUrl(dto.destinationUrl);
        if (!screening.valid) {
          const err: any = new Error(`Screening failed: ${screening.reason}`);
          err.statusCode = 400;
          err.code = ErrorCodes.SCREENING_FAILED;
          throw err;
        }
        await client.query(
          `INSERT INTO screening_results (link_id, provider, verdict, checked_at) VALUES ($1, $2, $3, NOW())`,
          [id, ScreeningProvider.HEURISTICS_SAFE_BROWSING, ScreeningVerdict.PENDING]
        );
      }

      const res = await client.query(
        `UPDATE links 
         SET destination_url = $1, status = $2, expires_at = $3, max_clicks = $4, tag = $5, short_code = $6, alias = $7, updated_at = NOW() 
         WHERE id = $8 AND tenant_id = $9 
         RETURNING *`,
        [destinationUrl, status, expiresAt, maxClicks, tag, newShortCode, newAlias, id, tenantId]
      );

      await AuditService.log(client, {
        tenantId,
        actorId: auth.keyId,
        actorType: 'api_key',
        action: 'link.update',
        entity: 'links',
        entityId: id,
        beforeState: { destinationUrl: current.destination_url, status: current.status, alias: current.alias, shortCode: current.short_code },
        afterState: { destinationUrl, status, alias: newAlias, shortCode: newShortCode },
        ipAddress: geoUa.clientIp,
      });

      return res.rows[0];
    });

    if (!updated) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    if (previousShortCode && previousShortCode !== updated.short_code) {
      await this.redis.invalidateLink(updated.domain_id, previousShortCode, tenantId, previousAlias);
    }
    if (previousAlias && previousAlias !== updated.alias) {
      await this.redis.invalidateLink(updated.domain_id, updated.short_code, tenantId, previousAlias);
    }
    await this.redis.invalidateLink(updated.domain_id, updated.short_code, tenantId, updated.alias);
    await this.redis.client.del(`link:detail:${tenantId}:${id}`).catch(() => {});

    if (dto.destinationUrl) {
      this.screeningQueue
        .add(
          JobNames.SCREEN_URL,
          { linkId: updated.id, destinationUrl: updated.destination_url },
          QueueRetryOptions.SCREENING
        )
        .catch(() => {});
    }

    return reply.send({ success: true, data: updated });
  }

  @Delete(':id')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async deleteLink(@Param('id') id: string, @Query('permanent') permanentStr: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const geoUa = getGeoUa(req);
    const isPermanent = permanentStr === 'true' || (req.query as any)?.permanent === 'true';

    const result = await this.db.withTenantContext(tenantId, async (client) => {
      let res;
      if (isPermanent) {
        res = await client.query(
          `DELETE FROM links WHERE id = $1 AND tenant_id = $2 RETURNING id, domain_id, short_code, alias`,
          [id, tenantId]
        );
      } else {
        res = await client.query(
          `UPDATE links SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING id, domain_id, short_code, alias`,
          [LinkStatus.ARCHIVED, id, tenantId]
        );
      }
      if (res.rowCount === 0) return null;

      await AuditService.log(client, {
        tenantId,
        actorId: auth.keyId,
        actorType: 'api_key',
        action: isPermanent ? 'link.delete_permanent' : 'link.archive',
        entity: 'links',
        entityId: id,
        ipAddress: geoUa.clientIp,
      });

      return res.rows[0];
    });

    if (!result) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    await this.redis.invalidateLink(result.domain_id, result.short_code, tenantId, result.alias);
    await this.redis.client.del(`link:detail:${tenantId}:${id}`).catch(() => {});
    return reply.send({ success: true, message: isPermanent ? 'Link permanently deleted' : 'Link archived successfully' });
  }

  @Get(':id/qr')
  @Public()
  async downloadQr(@Param('id') id: string, @Query('format') formatStr: string, @Query('size') sizeStr: string, @Query('theme') theme: string, @Res() reply: FastifyReply) {
    const format = formatStr || QR_FORMATS[0];
    if (sizeStr) {
      const numSize = Number(sizeStr);
      if (isNaN(numSize) || numSize < 64 || numSize > 2048) {
        return reply.status(400).send({ success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'QR code size must be an integer between 64 and 2048 pixels' } });
      }
    }

    const res = await this.db.withSuperAdminContext(async (client) => {
      return client.query('SELECT short_code FROM links WHERE id = $1', [id]);
    });
    if (res.rowCount === 0) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    const link = res.rows[0];
    const shortUrl = UrlService.buildShortUrl(link.short_code);
    const parsedWidth = Number(sizeStr) || (format.toLowerCase() === 'png' ? QR_CONSTANTS.PNG_WIDTH_HIGH_RES : QR_CONSTANTS.PNG_WIDTH_STANDARD);

    let foregroundColor: string | undefined;
    if (theme === 'navy') foregroundColor = '#0D233A';
    else if (theme === 'emerald') foregroundColor = '#047857';
    else if (theme === 'black') foregroundColor = '#0F172A';

    if (format.toLowerCase() === 'png') {
      const pngBuffer = await QrService.generatePngBuffer(shortUrl, { width: parsedWidth, foregroundColor });
      return reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(pngBuffer);
    }

    const svgData = await QrService.generateSvg(shortUrl, { foregroundColor });
    return reply.type('image/svg+xml').header('Cache-Control', 'public, max-age=86400').send(svgData);
  }
}
