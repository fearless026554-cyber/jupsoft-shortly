import { Controller, Get, Post, Patch, Param, Query, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ApiScopes, ErrorCodes, SubscriptionPlans } from '../constants/index.js';

const createTenantSchema = z.object({
  code: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/, 'Code must be lowercase alphanumeric or hyphen'),
  name: z.string().min(2).max(255),
  planId: z.enum([
    SubscriptionPlans.INTERNAL_UNLIMITED,
    SubscriptionPlans.STANDARD,
    SubscriptionPlans.ENTERPRISE,
  ]),
});

const patchTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  status: z.enum(['active', 'suspended', 'archived']).optional(),
});

@Controller('api/v1/tenants')
@UseGuards(AuthGuard)
export class TenantsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Get()
  @RequireScope(ApiScopes.TENANTS_READ)
  async listTenants(
    @Query('limit') limitStr: string,
    @Query('cursor') cursor: string,
    @Res() reply: FastifyReply
  ) {
    const limit = Math.min(Math.max(1, limitStr ? parseInt(limitStr, 10) || 50 : 50), 100);
    const tenants = await this.db.withSuperAdminContext(async (client) => {
      let query = 'SELECT * FROM tenants';
      const params: any[] = [];
      if (cursor) {
        params.push(new Date(cursor));
        query += ` WHERE created_at < $1`;
      }
      params.push(limit);
      query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
      const res = await client.query(query, params);
      return res.rows;
    });
    return reply.send({ success: true, data: tenants });
  }

  @Post()
  @RequireScope(ApiScopes.TENANTS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async createTenant(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = createTenantSchema.parse(req.body);
    const created = await this.db.withSuperAdminContext(async (client) => {
      const res = await client.query(
        `INSERT INTO tenants (code, name, status, plan_id) VALUES ($1, $2, 'active', $3) RETURNING *`,
        [dto.code.toLowerCase(), dto.name, dto.planId]
      );
      return res.rows[0];
    });
    return reply.status(201).send({ success: true, data: created });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.TENANTS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async updateTenant(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = patchTenantSchema.parse(req.body);
    const updated = await this.db.withSuperAdminContext(async (client) => {
      const res = await client.query(
        `UPDATE tenants SET name = COALESCE($1, name), status = COALESCE($2, status), updated_at = NOW() WHERE id = $3 RETURNING *`,
        [dto.name || null, dto.status || null, id]
      );
      return res.rows[0];
    });

    if (!updated) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Tenant not found' } });
    }

    await this.redis.invalidateTenantStatus(id);
    return reply.send({ success: true, data: updated });
  }
}
