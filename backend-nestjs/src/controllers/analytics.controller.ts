import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { ApiScopes, ErrorCodes } from '../constants/index.js';

const analyticsQuerySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format').optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'startDate cannot be after endDate', path: ['startDate'] }
  );

@Controller('api/v1/analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Get('links/:id')
  @RequireScope(ApiScopes.ANALYTICS_READ)
  async getLinkAnalytics(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const dto = analyticsQuerySchema.parse({ startDate, endDate });
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const cacheKey = `analytics:link:${tenantId}:${id}:${dto.startDate || 'all'}:${dto.endDate || 'all'}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const result = await this.db.withTenantContext(tenantId, async (client) => {
      const linkRes = await client.query(
        'SELECT id, short_code, click_count, external_ref FROM links WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      if (linkRes.rowCount === 0) return null;
      const link = linkRes.rows[0];

      let query = `SELECT date, clicks, unique_clicks, by_device, by_os, by_browser, by_country, by_referrer
                   FROM click_daily WHERE link_id = $1 AND tenant_id = $2`;
      const params: any[] = [id, tenantId];

      if (dto.startDate) {
        params.push(dto.startDate);
        query += ` AND date >= $${params.length}`;
      }
      if (dto.endDate) {
        params.push(dto.endDate);
        query += ` AND date <= $${params.length}`;
      }
      query += ` ORDER BY date ASC`;

      const dailyRes = await client.query(query, params);

      const outcomeRes = await client.query(
        `SELECT COUNT(id) AS total_outcomes, COALESCE(SUM(value), 0) AS total_revenue
         FROM outcomes WHERE link_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );

      return { link, daily: dailyRes.rows, outcomes: outcomeRes.rows[0] };
    });

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Link not found' },
      });
    }

    await this.redis.client.setex(cacheKey, 60, JSON.stringify(result));

    return reply.send({ success: true, data: result });
  }

  @Get('summary')
  @RequireScope(ApiScopes.ANALYTICS_READ)
  async getTenantSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('tenantId') queryTenantId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const dto = analyticsQuerySchema.parse({ startDate, endDate });
    const auth = (req as any).auth;
    const isSuperAdmin = auth.role === 'super_admin' || auth.scopes?.includes('*');

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

    const cacheKey = `analytics:summary:${targetTenantId || 'global'}:${dto.startDate || 'all'}:${dto.endDate || 'all'}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      return reply.send({ success: true, data: JSON.parse(cached) });
    }

    const runQuery = async (client: any) => {
      const dateConditionDaily = dto.startDate && dto.endDate
        ? `AND date >= '${dto.startDate}' AND date <= '${dto.endDate}'`
        : dto.startDate
        ? `AND date >= '${dto.startDate}'`
        : dto.endDate
        ? `AND date <= '${dto.endDate}'`
        : `AND date >= CURRENT_DATE - INTERVAL '30 days'`;

      const dateConditionOutcomes = dto.startDate && dto.endDate
        ? `AND occurred_at >= '${dto.startDate}'::date AND occurred_at <= ('${dto.endDate}'::date + INTERVAL '1 day')`
        : dto.startDate
        ? `AND occurred_at >= '${dto.startDate}'::date`
        : dto.endDate
        ? `AND occurred_at <= ('${dto.endDate}'::date + INTERVAL '1 day')`
        : `AND occurred_at >= CURRENT_DATE - INTERVAL '30 days'`;

      const dateConditionLinks = dto.startDate && dto.endDate
        ? `AND created_at >= '${dto.startDate}'::date AND created_at <= ('${dto.endDate}'::date + INTERVAL '1 day')`
        : dto.startDate
        ? `AND created_at >= '${dto.startDate}'::date`
        : dto.endDate
        ? `AND created_at <= ('${dto.endDate}'::date + INTERVAL '1 day')`
        : `AND created_at >= CURRENT_DATE - INTERVAL '30 days'`;

      const tenantLinkFilter = targetTenantId ? `tenant_id = '${targetTenantId}' AND` : '';
      const tenantDailyFilter = targetTenantId ? `WHERE tenant_id = '${targetTenantId}'` : 'WHERE 1=1';
      const tenantOutcomeFilter = targetTenantId ? `WHERE tenant_id = '${targetTenantId}'` : 'WHERE 1=1';

      const stats = await client.query(
        `SELECT 
          (SELECT COUNT(id) FROM links WHERE ${tenantLinkFilter} status = 'active' ${dateConditionLinks}) AS total_active_links,
          (SELECT COALESCE(SUM(clicks), 0) FROM click_daily ${tenantDailyFilter} ${dateConditionDaily}) AS total_clicks,
          (SELECT COALESCE(SUM(unique_clicks), 0) FROM click_daily ${tenantDailyFilter} ${dateConditionDaily}) AS total_unique_clicks,
          (SELECT COALESCE(SUM(bot_clicks), 0) FROM click_daily ${tenantDailyFilter} ${dateConditionDaily}) AS total_bot_clicks,
          (SELECT COUNT(id) FROM outcomes ${tenantOutcomeFilter} ${dateConditionOutcomes}) AS total_outcomes,
          (SELECT COALESCE(SUM(value), 0) FROM outcomes ${tenantOutcomeFilter} ${dateConditionOutcomes}) AS total_revenue_attributed`
      );
      
      const detailsRes = await client.query(
        `SELECT by_device, by_os, by_browser, by_country, by_referrer FROM click_daily ${tenantDailyFilter} ${dateConditionDaily}`
      );

      const agg: Record<string, Record<string, number>> = {
        by_device: {},
        by_os: {},
        by_browser: {},
        by_country: {},
        by_referrer: {}
      };

      for (const row of detailsRes.rows) {
        ['by_device', 'by_os', 'by_browser', 'by_country', 'by_referrer'].forEach((col) => {
          const obj = row[col] || {};
          for (const [k, v] of Object.entries(obj)) {
            agg[col][k] = (agg[col][k] || 0) + Number(v);
          }
        });
      }

      return { ...stats.rows[0], ...agg };
    };

    const summary = isSuperAdmin && !targetTenantId
      ? await this.db.withSuperAdminContext(runQuery)
      : await this.db.withTenantContext(targetTenantId || auth.tenantId, runQuery);

    if (summary) {
      await this.redis.client.setex(cacheKey, 60, JSON.stringify(summary));
    }

    return reply.send({ success: true, data: summary });
  }
}
