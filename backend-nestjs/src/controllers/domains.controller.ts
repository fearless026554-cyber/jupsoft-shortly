import { Controller, Get, Post, Patch, Param, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ApiScopes, ErrorCodes, RedisKeyBuilder } from '../constants/index.js';

const createDomainSchema = z.object({
  hostname: z.string().min(3).max(255).regex(/^[a-z0-9.-]+$/, 'Invalid hostname format'),
  type: z.enum(['subdomain', 'custom']),
});

const patchDomainSchema = z.object({
  verificationStatus: z.enum(['pending', 'verified', 'failed']).optional(),
  dltStatus: z.enum(['pending', 'submitted', 'whitelisted', 'rejected']).optional(),
  dltRegistrationDetails: z.record(z.string(), z.unknown()).optional(),
  sslActive: z.boolean().optional(),
});

@Controller('api/v1/domains')
@UseGuards(AuthGuard)
export class DomainsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Get()
  @RequireScope(ApiScopes.LINKS_READ)
  async listDomains(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const domains = await this.db.pool.query(
      `SELECT id, tenant_id, hostname, type, verification_status, dlt_status, ssl_active, created_at
       FROM domains
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY (tenant_id IS NULL) DESC, created_at ASC`,
      [tenantId]
    );

    return reply.send({ success: true, data: domains.rows });
  }

  @Post()
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async createDomain(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = createDomainSchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    try {
      const res = await this.db.pool.query(
        `INSERT INTO domains (tenant_id, hostname, type, verification_status, dlt_status)
         VALUES ($1, $2, $3, 'pending', 'pending')
         RETURNING *`,
        [tenantId, dto.hostname.toLowerCase(), dto.type]
      );

      return reply.status(201).send({ success: true, data: res.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({
          success: false,
          error: { code: ErrorCodes.DOMAIN_CONFLICT, message: 'This hostname is already registered' },
        });
      }
      throw err;
    }
  }

  @Get(':id')
  @RequireScope(ApiScopes.LINKS_READ)
  async getDomain(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const res = await this.db.pool.query(
      `SELECT id, tenant_id, hostname, type, verification_status, dlt_status, dlt_registration_details, ssl_active, created_at
       FROM domains
       WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [id, tenantId]
    );

    if (res.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Domain not found' },
      });
    }

    return reply.send({ success: true, data: res.rows[0] });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async updateDomain(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;
    const dto = patchDomainSchema.parse(req.body);

    const currentRes = await this.db.pool.query(
      'SELECT * FROM domains WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
      [id, tenantId]
    );
    if (currentRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'Domain not found' },
      });
    }
    const current = currentRes.rows[0];

    const verificationStatus = dto.verificationStatus ?? current.verification_status;
    const dltStatus = dto.dltStatus ?? current.dlt_status;
    const dltRegistrationDetails = dto.dltRegistrationDetails
      ? JSON.stringify(dto.dltRegistrationDetails)
      : current.dlt_registration_details;
    const sslActive = dto.sslActive !== undefined ? dto.sslActive : current.ssl_active;

    const res = await this.db.pool.query(
      `UPDATE domains
       SET verification_status = $1, dlt_status = $2, dlt_registration_details = $3, ssl_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [verificationStatus, dltStatus, dltRegistrationDetails, sslActive, id]
    );

    await this.redis.client.del(RedisKeyBuilder.domain(current.hostname));

    return reply.send({ success: true, data: res.rows[0] });
  }
}
