import { Controller, Get, Post, Patch, Param, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ALL_USER_ROLES, AUTH_CONSTANTS, ApiScopes, ErrorCodes, UserStatus } from '../constants/index.js';

import bcrypt from 'bcryptjs';

const inviteUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  role: z.enum(ALL_USER_ROLES as any),
  password: z.string().min(6).optional(),
});

const patchUserRoleSchema = z.object({
  role: z.enum(ALL_USER_ROLES as any),
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]).optional(),
});

@Controller('api/v1/users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @RequireScope(ApiScopes.USERS_READ)
  async listUsers(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const users = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `SELECT id, tenant_id, name, email, role, status, last_login_at, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
      );
      return res.rows;
    });

    return reply.send({ success: true, data: users });
  }

  @Post()
  @RequireScope(ApiScopes.USERS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async inviteUser(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = inviteUserSchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const rawPassword = dto.password || 'Welcome@2026!';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const created = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, status, created_at`,
        [tenantId, dto.name, dto.email.toLowerCase(), passwordHash, dto.role, UserStatus.INVITED]
      );
      return res.rows[0];
    });

    return reply.status(201).send({ success: true, data: { ...created, initialPassword: rawPassword } });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.USERS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async updateUser(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = patchUserRoleSchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    const updated = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `UPDATE users SET role = $1, status = COALESCE($2, status), updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING id, name, email, role, status, updated_at`,
        [dto.role, dto.status || null, id, tenantId]
      );
      return res.rows[0];
    });

    if (!updated) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' } });
    }

    return reply.send({ success: true, data: updated });
  }
}
