import { Controller, Get, Post, Req, Res, UseGuards, UseInterceptors, Query } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { OutcomeService } from '../services/outcome.service.js';
import { AuditService } from '../services/audit.service.js';
import { getGeoUa } from '../common/middleware/geo-ua.middleware.js';
import { ApiScopes } from '../constants/index.js';

const outcomeEventSchema = z
  .object({
    linkId: z.string().uuid().optional(),
    eventId: z.string().min(1).max(128).optional(),
    externalRef: z.string().min(1).optional(),
    outcomeType: z.string().min(1, 'outcomeType is required'),
    value: z.number().nonnegative().optional(),
    occurredAt: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.linkId || data.externalRef, {
    message: 'Either linkId or externalRef must be provided',
  });

@Controller('api/v1/outcomes')
@UseGuards(AuthGuard)
export class OutcomesController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Post()
  @RequireScope(ApiScopes.OUTCOMES_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async postOutcome(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = outcomeEventSchema.parse(req.body);
    const auth = (req as any).auth;
    const geoUa = getGeoUa(req);
    const tenantId = auth.tenantId;

    const result = await this.db.withTenantContext(tenantId, async (client) => {
      const recorded = await OutcomeService.recordOutcome(client, tenantId, dto);

      await AuditService.log(client, {
        tenantId,
        actorId: auth.keyId,
        actorType: 'api_key',
        action: 'outcome.record',
        entity: 'outcomes',
        entityId: recorded.outcomeId,
        afterState: {
          outcomeType: recorded.outcomeType,
          value: recorded.value,
          linkId: recorded.matchedLinkId,
          status: recorded.status,
        },
        ipAddress: geoUa.clientIp,
      });

      return recorded;
    });

    // Invalidate report cache
    this.redis.client.del(`outcomes:report:${tenantId}:all`).catch(() => {});
    if (result.matchedLinkId) {
      this.redis.client.del(`outcomes:report:${tenantId}:${result.matchedLinkId}`).catch(() => {});
    }

    return reply.status(201).send({ success: true, data: result });
  }

  @Get()
  @RequireScope(ApiScopes.ANALYTICS_READ)
  async getOutcomes(@Query('limit') limit: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const limitNum = Math.min(Math.max(1, limit ? parseInt(limit, 10) || 50 : 50), 100);

    const outcomes = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `SELECT o.id, o.external_ref, o.outcome_type, o.value, o.occurred_at, l.short_code, l.tag 
         FROM outcomes o
         LEFT JOIN links l ON o.link_id = l.id
         WHERE o.tenant_id = $1
         ORDER BY o.occurred_at DESC LIMIT $2`,
        [tenantId, limitNum]
      );
      return res.rows;
    });

    return reply.send({ success: true, data: outcomes });
  }

  @Get('report')
  @RequireScope(ApiScopes.ANALYTICS_READ)
  async getReport(@Query('linkId') linkId: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const cacheKey = `outcomes:report:${tenantId}:${linkId || 'all'}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const report = await this.db.withTenantContext(tenantId, async (client) => {
      return OutcomeService.getAttributionReport(client, tenantId, linkId);
    });

    if (report) {
      await this.redis.client.setex(cacheKey, 60, JSON.stringify(report));
    }

    return reply.send({ success: true, data: report });
  }
}
