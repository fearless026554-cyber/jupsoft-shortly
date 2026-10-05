import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
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
  constructor(private readonly db: DatabaseService) {}

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

    return reply.send({ success: true, data: result });
  }

  @Get('summary')
  @RequireScope(ApiScopes.ANALYTICS_READ)
  async getTenantSummary(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const summary = await this.db.withTenantContext(tenantId, async (client) => {
      const stats = await client.query(
        `SELECT 
          (SELECT COUNT(id) FROM links WHERE tenant_id = $1 AND status = 'active' AND created_at >= CURRENT_DATE - INTERVAL '30 days') AS total_active_links,
          (SELECT COALESCE(SUM(click_count), 0) FROM links WHERE tenant_id = $1 AND status = 'active') AS total_clicks,
          (SELECT COALESCE(SUM(unique_clicks), 0) FROM click_daily WHERE tenant_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days') AS total_unique_clicks,
          (SELECT COALESCE(SUM(bot_clicks), 0) FROM click_daily WHERE tenant_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days') AS total_bot_clicks,
          (SELECT COUNT(id) FROM outcomes WHERE tenant_id = $1 AND occurred_at >= CURRENT_DATE - INTERVAL '30 days') AS total_outcomes,
          (SELECT COALESCE(SUM(value), 0) FROM outcomes WHERE tenant_id = $1 AND occurred_at >= CURRENT_DATE - INTERVAL '30 days') AS total_revenue_attributed`,
        [tenantId]
      );
      
      const detailsRes = await client.query(
        `SELECT by_device, by_os, by_browser, by_country, by_referrer FROM click_daily WHERE tenant_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'`,
        [tenantId]
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
    });

    return reply.send({ success: true, data: summary });
  }
}
