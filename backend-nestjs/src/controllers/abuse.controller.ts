import { Controller, Get, Post, Patch, Param, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { ABUSE_LIMITS, ApiScopes, ErrorCodes } from '../constants/index.js';

const reportAbuseSchema = z.object({
  linkShortCodeOrUrl: z.string().min(1),
  reason: z.string().min(ABUSE_LIMITS.MIN_REASON_LEN, 'Please provide a detailed reason'),
  reporterEmail: z.string().email().optional(),
});

const moderateAbuseSchema = z.object({
  status: z.enum(['pending', 'investigating', 'resolved', 'dismissed']),
  disableLink: z.boolean().optional(),
  suspendTenant: z.boolean().optional(),
});

@Controller('api/v1/abuse-reports')
export class AbuseController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Post()
  async reportAbuse(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = reportAbuseSchema.parse(req.body);

    const input = dto.linkShortCodeOrUrl.trim();
    let hostname: string | null = null;
    let pathPart = input;

    if (input.startsWith('http://') || input.startsWith('https://')) {
      try {
        const parsed = new URL(input);
        hostname = parsed.hostname.toLowerCase();
        pathPart = parsed.pathname.replace(/^\/+|\/+$/g, '');
      } catch {
        pathPart = input.replace(/^https?:\/\//, '').replace(/^\/+|\/+$/g, '');
      }
    } else {
      pathPart = input.replace(/^\/+|\/+$/g, '');
    }

    const segments = pathPart.split('/').filter(Boolean);
    let linkId: string | null = null;

    if (segments.length >= 2) {
      const [tenantCode, alias] = segments;
      const aliasRes = await this.db.pool.query(
        `SELECT l.id FROM links l JOIN tenants t ON l.tenant_id = t.id WHERE t.code = $1 AND l.alias = $2`,
        [tenantCode.toLowerCase(), alias.toLowerCase()]
      );
      if (aliasRes.rowCount && aliasRes.rowCount > 0) {
        linkId = aliasRes.rows[0].id;
      }
    }

    if (!linkId) {
      const code = segments[segments.length - 1] || pathPart;
      let query = 'SELECT id FROM links WHERE short_code = $1';
      const params: any[] = [code];

      if (hostname) {
        const domRes = await this.db.pool.query('SELECT id FROM domains WHERE hostname = $1', [hostname]);
        if (domRes.rowCount && domRes.rowCount > 0) {
          query += ' AND domain_id = $2';
          params.push(domRes.rows[0].id);
        }
      }
      query += ' ORDER BY created_at DESC LIMIT 1';
      const res = await this.db.pool.query(query, params);
      if (res.rowCount && res.rowCount > 0) {
        linkId = res.rows[0].id;
      }
    }

    if (!linkId) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Target link could not be located' } });
    }

    const insertRes = await this.db.pool.query(
      `INSERT INTO abuse_reports (link_id, reason, reporter_email, status) VALUES ($1, $2, $3, 'pending') RETURNING id, status, created_at`,
      [linkId, dto.reason, dto.reporterEmail || null]
    );

    return reply.status(201).send({
      success: true,
      message: 'Abuse report successfully logged and queued for administrative review',
      data: { reportId: insertRes.rows[0].id, status: insertRes.rows[0].status, createdAt: insertRes.rows[0].created_at },
    });
  }

  @Get()
  @UseGuards(AuthGuard)
  @RequireScope(ApiScopes.ADMIN)
  async listReports(@Query('status') status: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const reports = await this.db.withSuperAdminContext(async (client) => {
      let query = `SELECT r.*, l.short_code, l.destination_url, l.tenant_id, t.name AS tenant_name FROM abuse_reports r JOIN links l ON r.link_id = l.id JOIN tenants t ON l.tenant_id = t.id`;
      const params: any[] = [];
      if (status) {
        query += ` WHERE r.status = $1`;
        params.push(status);
      }
      query += ` ORDER BY r.created_at DESC`;
      const res = await client.query(query, params);
      return res.rows;
    });

    return reply.send({ success: true, data: reports });
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @RequireScope(ApiScopes.ADMIN)
  async moderateReport(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = moderateAbuseSchema.parse(req.body);

    const result = await this.db.withSuperAdminContext(async (client) => {
      const reportRes = await client.query(
        `SELECT r.*, l.domain_id, l.short_code, l.alias, l.tenant_id FROM abuse_reports r JOIN links l ON r.link_id = l.id WHERE r.id = $1`,
        [id]
      );
      if (reportRes.rowCount === 0) return null;
      const report = reportRes.rows[0];

      await client.query(`UPDATE abuse_reports SET status = $1, resolved_at = NOW() WHERE id = $2`, [dto.status, id]);

      if (dto.disableLink) {
        await client.query(`UPDATE links SET status = 'blocked', updated_at = NOW() WHERE id = $1`, [report.link_id]);
        await this.redis.invalidateLink(report.domain_id, report.short_code, report.tenant_id, report.alias);
      }

      if (dto.suspendTenant) {
        await client.query(`UPDATE tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1`, [report.tenant_id]);
        await this.redis.invalidateTenantStatus(report.tenant_id);
      }

      return { reportId: id, status: dto.status, linkBlocked: Boolean(dto.disableLink), tenantSuspended: Boolean(dto.suspendTenant) };
    });

    if (!result) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Abuse report not found' } });
    }

    return reply.send({ success: true, data: result });
  }
}
