import { Controller, Get, Post, Patch, Param, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import { ALL_USER_ROLES, AUTH_CONSTANTS, ApiScopes, ErrorCodes, UserRoles, UserStatus } from '../constants/index.js';

import bcrypt from 'bcryptjs';

const inviteUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  role: z.enum(ALL_USER_ROLES as any),
  password: z.string().min(6).optional(),
});

const patchUserRoleSchema = z.object({
  role: z.enum(ALL_USER_ROLES as any).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]).optional(),
  password: z.string().min(6).optional(),
});

@Controller('api/v1/users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

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

    // Security Gate: Prevent privilege escalation to super_admin
    if (dto.role === UserRoles.SUPER_ADMIN && auth.role !== UserRoles.SUPER_ADMIN) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Only super administrators can assign the super_admin role' },
      });
    }

    const isGeneratedPassword = !dto.password;
    const rawPassword = dto.password || crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const initialStatus = isGeneratedPassword ? UserStatus.INVITED : UserStatus.ACTIVE;

    const created = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, status, created_at`,
        [tenantId, dto.name, dto.email.toLowerCase(), passwordHash, dto.role, initialStatus]
      );
      return res.rows[0];
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...created,
        initialPassword: rawPassword,
        mustResetPassword: isGeneratedPassword,
      },
    });
  }

  @Patch(':id')
  @RequireScope(ApiScopes.USERS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async updateUser(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const dto = patchUserRoleSchema.parse(req.body);
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    // Security Gate: Only admins can alter user roles or passwords
    if (dto.role && auth.role !== UserRoles.SUPER_ADMIN && auth.role !== UserRoles.TENANT_ADMIN) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Only administrators can update user roles' },
      });
    }

    // Security Gate: Prevent privilege escalation to super_admin
    if (dto.role === UserRoles.SUPER_ADMIN && auth.role !== UserRoles.SUPER_ADMIN) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Only super administrators can assign the super_admin role' },
      });
    }

    if (dto.password && auth.role !== UserRoles.SUPER_ADMIN && auth.role !== UserRoles.TENANT_ADMIN) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Only administrators can reset user passwords' },
      });
    }

    // Security Gate: Cannot modify a super_admin unless caller is super_admin
    const targetCheck = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query('SELECT role FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      return res.rows[0];
    });

    if (!targetCheck) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' } });
    }

    if (targetCheck.role === UserRoles.SUPER_ADMIN && auth.role !== UserRoles.SUPER_ADMIN) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Only super administrators can modify a super administrator account' },
      });
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const updated = await this.db.withTenantContext(tenantId, async (client) => {
      const res = await client.query(
        `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status), password_hash = COALESCE($3, password_hash), updated_at = NOW() WHERE id = $4 AND tenant_id = $5 RETURNING id, name, email, role, status, updated_at`,
        [dto.role || null, dto.status || null, passwordHash, id, tenantId]
      );
      return res.rows[0];
    });

    await this.redis.invalidateUserStatus(id);
    return reply.send({ success: true, data: updated });
  }
}
