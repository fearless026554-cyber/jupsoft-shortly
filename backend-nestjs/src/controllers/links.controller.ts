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

function isLinkPermanent(link: any): boolean {
  if (!link) return false;
  if (link.is_permanent === true || link.isPermanent === true) return true;
  if (typeof link.external_ref === 'string') {
    if (link.external_ref === 'PERMANENT' || link.external_ref.startsWith('PERMANENT')) return true;
  }
  if (typeof link.externalRef === 'string') {
    if (link.externalRef === 'PERMANENT' || link.externalRef.startsWith('PERMANENT')) return true;
  }
  if (typeof link.tag === 'string' && link.tag.toLowerCase() === 'permanent') return true;
  const dest = link.destination_url || link.destinationUrl;
  if (typeof dest === 'string' && (dest.includes('play.google.com') || dest.includes('apps.apple.com'))) {
    return true;
  }
  return false;
}

const createLinkSchema = z.object({
  destinationUrl: z.string().url('Must be a valid URL'),
  alias: z.string().max(LINK_LIMITS.MAX_ALIAS_LEN).optional(),
  domainId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  maxClicks: z.number().int().positive().optional(),
  tag: z.string().max(LINK_LIMITS.MAX_TAG_LEN).optional(),
  externalRef: z.string().max(LINK_LIMITS.MAX_EXTERNAL_REF_LEN).optional(),
  redirectType: z.enum(REDIRECT_TYPES).default(String(FALLBACKS.REDIRECT_TYPE) as RedirectType),
  isPermanent: z.boolean().optional(),
  is_permanent: z.boolean().optional(),
});

const patchLinkSchema = z.object({
  destinationUrl: z.string().url().optional(),
  status: z.enum(PATCHABLE_LINK_STATUSES).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxClicks: z.number().int().positive().nullable().optional(),
  tag: z.string().max(LINK_LIMITS.MAX_TAG_LEN).nullable().optional(),
  alias: z.string().max(LINK_LIMITS.MAX_ALIAS_LEN).nullable().optional(),
  isPermanent: z.boolean().optional(),
  is_permanent: z.boolean().optional(),
});

const bulkCreateSchema = z.object({
  tenantId: z.string().uuid().optional(),
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

const batchActionSchema = z.object({
  action: z.enum(['archive', 'restore', 'delete']),
  ids: z.array(z.string().min(1)).min(1).max(BULK_LIMITS.MAX_BATCH_SIZE),
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
    const isSuperAdmin =
      auth.role === UserRoles.SUPER_ADMIN ||
      auth.scopes?.includes(ApiScopes.SUPER_ADMIN) ||
      auth.scopes?.includes(ApiScopes.WILDCARD);

    if (dto.tenantId && dto.tenantId !== auth.tenantId && !isSuperAdmin) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Cannot create links for other tenants' },
      });
    }

    const tenantId = isSuperAdmin && dto.tenantId ? dto.tenantId : auth.tenantId;

    if (isSuperAdmin && dto.tenantId) {
      const tenantCheck = await this.db.pool.query('SELECT id, status FROM tenants WHERE id = $1', [tenantId]);
      if (tenantCheck.rowCount === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: ErrorCodes.NOT_FOUND, message: 'Target tenant does not exist' },
        });
      }
    }

    let domainId: string = dto.domainId || env.DEFAULT_DOMAIN_ID;
    if (!dto.domainId) {
      domainId = await this.redis.getTenantPrimaryDomainId(tenantId);
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

    const wantsPermanent = Boolean(dto.isPermanent || (dto as any).is_permanent);
    if (wantsPermanent) {
      dto.externalRef = dto.externalRef ? `PERMANENT:${dto.externalRef}` : 'PERMANENT';
    }

    const tenantCode = await this.redis.getTenantCode(tenantId);
    const result = await this.db.withTenantContext(tenantId, async (client) => {
      const created = await LinkService.createLink(client, tenantId, dto, domainId, {
        tenantCode: tenantCode || undefined,
      });
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
        status: linkRow.status || 'active',
        tag: linkRow.tag || dto.tag || 'General',
        alias: linkRow.alias || dto.alias || null,
        click_count: 0,
        expiresAt: linkRow.expires_at || linkRow.expiresAt || null,
        expires_at: linkRow.expires_at || linkRow.expiresAt || null,
        maxClicks: linkRow.max_clicks || dto.maxClicks || null,
        max_clicks: linkRow.max_clicks || dto.maxClicks || null,
        externalRef: linkRow.external_ref || linkRow.externalRef || null,
        external_ref: linkRow.external_ref || linkRow.externalRef || null,
        isPermanent: wantsPermanent || isLinkPermanent(linkRow),
        is_permanent: wantsPermanent || isLinkPermanent(linkRow),
        createdAt: linkRow.created_at || linkRow.createdAt || new Date().toISOString(),
        created_at: linkRow.created_at || linkRow.createdAt || new Date().toISOString(),
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
    const isSuperAdmin =
      auth.role === UserRoles.SUPER_ADMIN ||
      auth.scopes?.includes(ApiScopes.SUPER_ADMIN) ||
      auth.scopes?.includes(ApiScopes.WILDCARD);

    if (dto.tenantId && dto.tenantId !== auth.tenantId && !isSuperAdmin) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Cannot create bulk links for other tenants' },
      });
    }

    const tenantId = isSuperAdmin && dto.tenantId ? dto.tenantId : auth.tenantId;
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
    let result = job.returnvalue;
    const isCancelled = await this.redis.client.get(`bulk:cancel:${jobId}`).catch(() => null);

    // Fallback to Redis cached results if job was cancelled or completed
    if (!result) {
      const cachedRaw = await this.redis.client.get(`bulk:results:${jobId}`).catch(() => null);
      if (cachedRaw) {
        try {
          result = JSON.parse(cachedRaw);
        } catch {}
      }
    }

    return reply.send({
      success: true,
      data: {
        jobId,
        status: isCancelled ? 'cancelled' : state,
        progress: progress || (result?.completed ? Math.round((result.completed / (result.total || 1)) * 100) : 0),
        result: result || null,
      },
    });
  }

  @Post('bulk/:jobId/cancel')
  @RequireScope(ApiScopes.LINKS_WRITE)
  async cancelBulkJob(
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

    // Set cancellation token in Redis for active workers to break gracefully and rollback minted links
    await this.redis.client.set(`bulk:cancel:${jobId}`, '1', 'EX', 3600);

    return reply.send({
      success: true,
      data: { jobId, status: 'cancelled', message: 'Bulk job cancellation signal sent successfully. Minted links will be rolled back and not saved.' },
    });
  }

  @Post('batch-action')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async batchAction(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = batchActionSchema.parse(req.body);
    const auth = (req as any).auth;
    const isSuperAdmin =
      auth?.role === UserRoles.SUPER_ADMIN ||
      auth?.scopes?.includes(ApiScopes.SUPER_ADMIN) ||
      auth?.scopes?.includes(ApiScopes.WILDCARD);
    const tenantId = auth?.tenantId;
    const geoUa = getGeoUa(req);

    const validIds = dto.ids.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );

    if (validIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCodes.INVALID_INPUT, message: 'No valid link UUIDs provided' },
      });
    }

    const isSuperOrAdmin = auth?.role === UserRoles.SUPER_ADMIN || auth?.role === UserRoles.TENANT_ADMIN || auth?.scopes?.includes('*');

    const runBatch = async (client: any) => {
      // Security check: inspect permanent links in the target batch
      const inspectRes = await client.query(
        isSuperAdmin
          ? `SELECT id, short_code, alias, domain_id, destination_url, external_ref, tag, status, tenant_id FROM links WHERE id = ANY($1::uuid[])`
          : `SELECT id, short_code, alias, domain_id, destination_url, external_ref, tag, status, tenant_id FROM links WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
        isSuperAdmin ? [validIds] : [validIds, tenantId]
      );
      const targetRows = inspectRes.rows;
      if (targetRows.length === 0) return [];

      const permRows = targetRows.filter((r: any) => isLinkPermanent(r));
      const hasPerm = permRows.length > 0;

      if (dto.action === 'restore') {
        // Restriction: ONLY permanent links can be restored!
        if (permRows.length === 0) {
          const err: any = new Error('Restoration is only allowed for Permanent links. None of the selected links are permanent.');
          err.statusCode = 403;
          err.code = ErrorCodes.FORBIDDEN;
          throw err;
        }
        if (!isSuperOrAdmin) {
          const err: any = new Error('Only Super Administrators and Administrators can restore permanent links.');
          err.statusCode = 403;
          err.code = ErrorCodes.FORBIDDEN;
          throw err;
        }
      } else {
        // Delete or archive: If any target link is permanent, only Super Admin and Admin can delete it
        if (hasPerm && !isSuperOrAdmin) {
          const err: any = new Error('Batch contains Permanent Links. Only Super Administrators and Administrators can delete or archive permanent links.');
          err.statusCode = 403;
          err.code = ErrorCodes.FORBIDDEN;
          throw err;
        }
      }

      // For restore, only update the permanent link IDs
      const targetIdsToProcess = dto.action === 'restore' ? permRows.map((r: any) => r.id) : validIds;

      let query = '';
      const params: any[] = [targetIdsToProcess];

      if (dto.action === 'delete') {
        if (isSuperAdmin) {
          query = `DELETE FROM links WHERE id = ANY($1::uuid[]) RETURNING id, domain_id, short_code, alias, tenant_id`;
        } else {
          params.push(tenantId);
          query = `DELETE FROM links WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id, domain_id, short_code, alias, tenant_id`;
        }
      } else {
        const targetStatus = dto.action === 'archive' ? LinkStatus.ARCHIVED : LinkStatus.ACTIVE;
        params.push(targetStatus);
        if (isSuperAdmin) {
          query = `UPDATE links SET status = $2, updated_at = NOW() WHERE id = ANY($1::uuid[]) RETURNING id, domain_id, short_code, alias, tenant_id`;
        } else {
          params.push(tenantId);
          query = `UPDATE links SET status = $2, updated_at = NOW() WHERE id = ANY($1::uuid[]) AND tenant_id = $3 RETURNING id, domain_id, short_code, alias, tenant_id`;
        }
      }

      const res = await client.query(query, params);

      if (res.rowCount > 0) {
        await AuditService.log(client, {
          tenantId: tenantId || res.rows[0].tenant_id,
          actorId: auth?.keyId || auth?.userId || 'system',
          actorType: auth?.keyId ? 'api_key' : 'user',
          action: `link.batch_${dto.action}`,
          entity: 'links',
          entityId: 'batch',
          afterState: { count: res.rowCount, action: dto.action },
          ipAddress: geoUa.clientIp,
        });
      }

      return res.rows;
    };

    const affectedRows = isSuperAdmin
      ? await this.db.withSuperAdminContext(runBatch)
      : await this.db.withTenantContext(tenantId, runBatch);

    if (affectedRows && affectedRows.length > 0) {
      const pipeline = this.redis.client.pipeline();
      for (const row of affectedRows) {
        const rowTenant = row.tenant_id || tenantId || 'global';
        pipeline.del(`link:detail:${rowTenant}:${row.id}`);
        pipeline.del(`link:code:${row.domain_id}:${row.short_code}`);
        if (row.alias) {
          pipeline.del(`link:alias:${rowTenant}:${row.alias}`);
        }
      }
      await pipeline.exec().catch(() => {});
    }

    return reply.send({
      success: true,
      data: {
        action: dto.action,
        count: affectedRows?.length || 0,
        affectedIds: (affectedRows || []).map((r: any) => r.id),
      },
      message: `Successfully ${dto.action === 'archive' ? 'archived' : dto.action === 'restore' ? 'restored' : 'deleted'} ${affectedRows?.length || 0} links`,
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
        if (cursor.includes('__')) {
          const [curTime, curId] = cursor.split('__');
          params.push(new Date(curTime));
          const timeIdx = params.length;
          params.push(curId);
          const idIdx = params.length;
          conditions.push(`(created_at < $${timeIdx} OR (created_at = $${timeIdx} AND id < $${idIdx}))`);
        } else {
          params.push(new Date(cursor));
          conditions.push(`created_at < $${params.length}`);
        }
      }

      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }

      params.push(limit);
      query += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length}`;

      const res = await client.query(query, params);
      return res.rows;
    };

    const links = isSuperAdmin && !targetTenantId
      ? await this.db.withSuperAdminContext(runQuery)
      : await this.db.withTenantContext(targetTenantId || auth.tenantId, runQuery);

    const lastItem = links.length === limit ? links[links.length - 1] : null;
    const nextCursor = lastItem
      ? `${lastItem.created_at instanceof Date ? lastItem.created_at.toISOString() : lastItem.created_at}__${lastItem.id}`
      : null;

    return reply.send({
      success: true,
      data: {
        items: links.map((l: any) => {
          const perm = isLinkPermanent(l);
          return {
            ...l,
            is_permanent: perm,
            isPermanent: perm,
            shortUrl: UrlService.buildShortUrl(l.short_code),
          };
        }),
        nextCursor,
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

    const perm = isLinkPermanent(link);
    const responseData = {
      ...link,
      is_permanent: perm,
      isPermanent: perm,
      shortUrl: UrlService.buildShortUrl(link.short_code),
    };
    await this.redis.client.setex(cacheKey, 120, JSON.stringify(responseData));

    return reply.send({ success: true, data: responseData });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async updateLink(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = patchLinkSchema.parse(req.body);
    const auth = (req as any).auth;
    const isSuperAdmin =
      auth?.role === UserRoles.SUPER_ADMIN ||
      auth?.scopes?.includes(ApiScopes.SUPER_ADMIN) ||
      auth?.scopes?.includes(ApiScopes.WILDCARD);
    const tenantId = auth?.tenantId;
    const geoUa = getGeoUa(req);

    let previousAlias: string | null = null;
    let previousShortCode: string | null = null;

    const runUpdate = async (client: any) => {
      let currentRes;
      if (isSuperAdmin) {
        currentRes = await client.query('SELECT * FROM links WHERE id = $1', [id]);
      } else {
        currentRes = await client.query('SELECT * FROM links WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      }

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
          const targetTenant = tenantId || current.tenant_id;
          const existing = await client.query(
            `SELECT id FROM links 
             WHERE ((domain_id = $1 AND (short_code = $2 OR LOWER(alias) = LOWER($2)))
                OR (tenant_id = $3 AND (short_code = $2 OR LOWER(alias) = LOWER($2))))
               AND id != $4
             LIMIT 1`,
            [current.domain_id, sanitized, targetTenant, id]
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

      const isPerm = isLinkPermanent(current);

      // Restriction: Only permanent links can be restored
      if (dto.status === 'active' && current.status === 'archived') {
        if (!isPerm) {
          const err: any = new Error('Restoration is only allowed for Permanent links. Standard non-permanent links cannot be restored once archived.');
          err.statusCode = 403;
          err.code = ErrorCodes.FORBIDDEN;
          throw err;
        }
        const isSuperOrAdmin = auth?.role === UserRoles.SUPER_ADMIN || auth?.role === UserRoles.TENANT_ADMIN || auth?.scopes?.includes('*');
        if (!isSuperOrAdmin) {
          const err: any = new Error('Only Super Administrators and Administrators can restore permanent links.');
          err.statusCode = 403;
          err.code = ErrorCodes.FORBIDDEN;
          throw err;
        }
      }

      // Permanent protection toggle
      let newExternalRef = current.external_ref;
      const targetPermanent = dto.isPermanent !== undefined ? dto.isPermanent : (dto as any).is_permanent;
      if (targetPermanent !== undefined && targetPermanent !== isPerm) {
        const isSuperOrAdmin = auth?.role === UserRoles.SUPER_ADMIN || auth?.role === UserRoles.TENANT_ADMIN || auth?.scopes?.includes('*');
        if (!isSuperOrAdmin) {
          const err: any = new Error('Only Super Administrators and Administrators can modify permanent protection status.');
          err.statusCode = 403;
          err.code = ErrorCodes.FORBIDDEN;
          throw err;
        }
        if (targetPermanent) {
          newExternalRef = current.external_ref ? `PERMANENT:${current.external_ref.replace(/^PERMANENT:?/, '')}` : 'PERMANENT';
        } else {
          newExternalRef = current.external_ref ? current.external_ref.replace(/^PERMANENT:?/, '') || null : null;
        }
      }

      let res;
      if (isSuperAdmin) {
        res = await client.query(
          `UPDATE links 
           SET destination_url = $1, status = $2, expires_at = $3, max_clicks = $4, tag = $5, short_code = $6, alias = $7, external_ref = $8, updated_at = NOW() 
           WHERE id = $9 
           RETURNING *`,
          [destinationUrl, status, expiresAt, maxClicks, tag, newShortCode, newAlias, newExternalRef, id]
        );
      } else {
        res = await client.query(
          `UPDATE links 
           SET destination_url = $1, status = $2, expires_at = $3, max_clicks = $4, tag = $5, short_code = $6, alias = $7, external_ref = $8, updated_at = NOW() 
           WHERE id = $9 AND tenant_id = $10 
           RETURNING *`,
          [destinationUrl, status, expiresAt, maxClicks, tag, newShortCode, newAlias, newExternalRef, id, tenantId || current.tenant_id]
        );
      }

      await AuditService.log(client, {
        tenantId: tenantId || current.tenant_id,
        actorId: auth?.keyId || auth?.userId || 'system',
        actorType: auth?.keyId ? 'api_key' : 'user',
        action: 'link.update',
        entity: 'links',
        entityId: id,
        beforeState: { destinationUrl: current.destination_url, status: current.status, alias: current.alias, shortCode: current.short_code },
        afterState: { destinationUrl, status, alias: newAlias, shortCode: newShortCode },
        ipAddress: geoUa.clientIp,
      });

      return res.rows[0];
    };

    const updated = isSuperAdmin
      ? await this.db.withSuperAdminContext(runUpdate)
      : await this.db.withTenantContext(tenantId!, runUpdate);

    if (!updated) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    const effectiveTenant = tenantId || updated.tenant_id || 'global';
    if (previousShortCode && previousShortCode !== updated.short_code) {
      await this.redis.invalidateLink(updated.domain_id, previousShortCode, effectiveTenant, previousAlias);
    }
    if (previousAlias && previousAlias !== updated.alias) {
      await this.redis.invalidateLink(updated.domain_id, updated.short_code, effectiveTenant, previousAlias);
    }
    await this.redis.invalidateLink(updated.domain_id, updated.short_code, effectiveTenant, updated.alias);
    await this.redis.client.del(`link:detail:${effectiveTenant}:${id}`).catch(() => {});

    if (dto.destinationUrl) {
      this.screeningQueue
        .add(
          JobNames.SCREEN_URL,
          { linkId: updated.id, destinationUrl: updated.destination_url },
          QueueRetryOptions.SCREENING
        )
        .catch(() => {});
    }

    return reply.send({
      success: true,
      data: {
        ...updated,
        is_permanent: isLinkPermanent(updated),
        isPermanent: isLinkPermanent(updated),
      },
    });
  }

  @Delete(':id')
  @RequireScope(ApiScopes.LINKS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async deleteLink(@Param('id') id: string, @Query('permanent') permanentStr: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const isSuperAdmin =
      auth?.role === UserRoles.SUPER_ADMIN ||
      auth?.scopes?.includes(ApiScopes.SUPER_ADMIN) ||
      auth?.scopes?.includes(ApiScopes.WILDCARD);
    const tenantId = auth?.tenantId;
    const geoUa = getGeoUa(req);
    const isPermanent = permanentStr === 'true' || (req.query as any)?.permanent === 'true';

    const isSuperOrAdmin = auth?.role === UserRoles.SUPER_ADMIN || auth?.role === UserRoles.TENANT_ADMIN || auth?.scopes?.includes('*');

    const runDelete = async (client: any) => {
      // Security check: inspect target link
      const targetQuery = isSuperAdmin
        ? `SELECT id, domain_id, short_code, alias, tenant_id, destination_url, external_ref, tag FROM links WHERE id = $1`
        : `SELECT id, domain_id, short_code, alias, tenant_id, destination_url, external_ref, tag FROM links WHERE id = $1 AND tenant_id = $2`;
      const targetParams = isSuperAdmin ? [id] : [id, tenantId];
      const targetCheck = await client.query(targetQuery, targetParams);
      if (targetCheck.rowCount === 0) return null;
      const targetLink = targetCheck.rows[0];

      if (isLinkPermanent(targetLink) && !isSuperOrAdmin) {
        const err: any = new Error('This is a Permanent Link. Only Super Administrators and Administrators can delete or archive permanent links.');
        err.statusCode = 403;
        err.code = ErrorCodes.FORBIDDEN;
        throw err;
      }

      let res;
      if (isPermanent) {
        if (isSuperAdmin) {
          res = await client.query(
            `DELETE FROM links WHERE id = $1 RETURNING id, domain_id, short_code, alias, tenant_id`,
            [id]
          );
        } else {
          res = await client.query(
            `DELETE FROM links WHERE id = $1 AND tenant_id = $2 RETURNING id, domain_id, short_code, alias, tenant_id`,
            [id, tenantId]
          );
        }
      } else {
        if (isSuperAdmin) {
          res = await client.query(
            `UPDATE links SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, domain_id, short_code, alias, tenant_id`,
            [LinkStatus.ARCHIVED, id]
          );
        } else {
          res = await client.query(
            `UPDATE links SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING id, domain_id, short_code, alias, tenant_id`,
            [LinkStatus.ARCHIVED, id, tenantId]
          );
        }
      }
      if (res.rowCount === 0) return null;

      const row = res.rows[0];
      await AuditService.log(client, {
        tenantId: tenantId || row.tenant_id,
        actorId: auth?.keyId || auth?.userId || 'system',
        actorType: auth?.keyId ? 'api_key' : 'user',
        action: isPermanent ? 'link.delete_permanent' : 'link.archive',
        entity: 'links',
        entityId: id,
        ipAddress: geoUa.clientIp,
      });

      return row;
    };

    const result = isSuperAdmin
      ? await this.db.withSuperAdminContext(runDelete)
      : await this.db.withTenantContext(tenantId!, runDelete);

    if (!result) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' } });
    }

    const effectiveTenant = tenantId || result.tenant_id || 'global';
    await this.redis.invalidateLink(result.domain_id, result.short_code, effectiveTenant, result.alias);
    await this.redis.client.del(`link:detail:${effectiveTenant}:${id}`).catch(() => {});
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
