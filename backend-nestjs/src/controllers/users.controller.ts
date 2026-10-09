import { Controller, Get, Post, Patch, Delete, Param, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, RequireScope } from '../common/guards/auth.guard.js';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor.js';
import {
  ALL_USER_ROLES,
  ApiScopes,
  ErrorCodes,
  UserRoles,
  UserStatus,
  canManageTargetUser,
  canDeleteTargetUser,
  getAllowedInviteRoles,
  validatePasswordStrength,
} from '../constants/index.js';

import bcrypt from 'bcryptjs';

const ROOT_PROTECTED_EMAILS = ['admin@jupsoft.com', 'sachin@jupsoft.com', 'superadmin@jupsoft.com'];

function isRootSuperAdmin(email?: string): boolean {
  if (!email) return false;
  return ROOT_PROTECTED_EMAILS.includes(email.toLowerCase().trim());
}

const inviteUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  role: z.enum(ALL_USER_ROLES as any),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
});

const patchUserRoleSchema = z.object({
  role: z.enum(ALL_USER_ROLES as any).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
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
  async listUsers(
    @Query('limit') limitStr: string,
    @Query('cursor') cursor: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    const auth = (req as any).auth;
    const isSuperAdmin = auth.role === UserRoles.SUPER_ADMIN || auth.scopes?.includes(ApiScopes.SUPER_ADMIN) || auth.scopes?.includes(ApiScopes.WILDCARD);
    const tenantId = auth.tenantId;
    const limit = Math.min(Math.max(1, limitStr ? parseInt(limitStr, 10) || 50 : 50), 100);

    if (isSuperAdmin && !tenantId) {
      const users = await this.db.withSuperAdminContext(async (client) => {
        let query = `SELECT id, tenant_id, name, email, role, status, avatar_url, last_login_at, created_at FROM users`;
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
      return reply.send({ success: true, data: users });
    }

    const users = await this.db.withTenantContext(tenantId, async (client) => {
      let query = `SELECT id, tenant_id, name, email, role, status, avatar_url, last_login_at, created_at FROM users WHERE tenant_id = $1`;
      const params: any[] = [tenantId];
      if (cursor) {
        params.push(new Date(cursor));
        query += ` AND created_at < $2`;
      }
      params.push(limit);
      query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
      const res = await client.query(query, params);
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

    // Security Gate 1: Check allowed invite roles based on caller's role hierarchy
    const allowedRoles = getAllowedInviteRoles(auth.role);
    if (!allowedRoles.includes(dto.role as any)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: dto.role === UserRoles.SUPER_ADMIN
            ? 'Only super administrators can assign the super_admin role'
            : `Your role (${auth.role}) cannot assign the '${dto.role}' role`,
        },
      });
    }

    if (dto.password) {
      const strengthCheck = validatePasswordStrength(dto.password);
      if (!strengthCheck.valid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: strengthCheck.message || 'Password does not meet complexity requirements',
          },
        });
      }
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

    // Security Gate: Only admins and managers can alter user details
    if (auth.role !== UserRoles.SUPER_ADMIN && auth.role !== UserRoles.TENANT_ADMIN && auth.role !== UserRoles.MANAGER) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Only administrators can update user accounts' },
      });
    }

    // Security Gate 1: Prevent privilege escalation to super_admin or higher ranks
    if (dto.role) {
      const allowedRoles = getAllowedInviteRoles(auth.role);
      if (!allowedRoles.includes(dto.role as any)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: dto.role === UserRoles.SUPER_ADMIN
              ? 'Only super administrators can assign the super_admin role'
              : `Your role (${auth.role}) cannot assign the '${dto.role}' role`,
          },
        });
      }
    }

    // Lookup target user
    const targetCheck = auth.role === UserRoles.SUPER_ADMIN
      ? await this.db.withSuperAdminContext(async (client) => {
          const res = await client.query('SELECT id, email, role, status, tenant_id FROM users WHERE id = $1', [id]);
          return res.rows[0];
        })
      : await this.db.withTenantContext(tenantId, async (client) => {
          const res = await client.query('SELECT id, email, role, status, tenant_id FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
          return res.rows[0];
        });

    if (!targetCheck) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' } });
    }

    const isTargetRoot = isRootSuperAdmin(targetCheck.email);
    const isSelf = auth.userId === id;

    if (isTargetRoot) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Root master super administrator account is permanently protected and cannot be modified or demoted',
        },
      });
    }

    if (isSelf && dto.role && dto.role !== auth.role) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'You cannot change your own role to prevent administrative lockout',
        },
      });
    }

    // Security Gate: Check hierarchical authority
    if (!canManageTargetUser(auth.role, targetCheck.role, isTargetRoot, isSelf)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: targetCheck.role === UserRoles.SUPER_ADMIN
            ? 'Only super administrators can modify a super administrator account'
            : 'Insufficient hierarchical authority to modify this user account',
        },
      });
    }

    if (dto.password) {
      if (auth.role !== UserRoles.SUPER_ADMIN && auth.role !== UserRoles.TENANT_ADMIN) {
        return reply.status(403).send({
          success: false,
          error: { code: ErrorCodes.FORBIDDEN, message: 'Only administrators can reset user passwords' },
        });
      }

      const strengthCheck = validatePasswordStrength(dto.password);
      if (!strengthCheck.valid) {
        return reply.status(400).send({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: strengthCheck.message || 'Password does not meet complexity requirements',
          },
        });
      }
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const updated = auth.role === UserRoles.SUPER_ADMIN
      ? await this.db.withSuperAdminContext(async (client) => {
          const res = await client.query(
            `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status), password_hash = COALESCE($3, password_hash), updated_at = NOW() WHERE id = $4 RETURNING id, name, email, role, status, updated_at`,
            [dto.role || null, dto.status || null, passwordHash, id]
          );
          return res.rows[0];
        })
      : await this.db.withTenantContext(tenantId, async (client) => {
          const res = await client.query(
            `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status), password_hash = COALESCE($3, password_hash), updated_at = NOW() WHERE id = $4 AND tenant_id = $5 RETURNING id, name, email, role, status, updated_at`,
            [dto.role || null, dto.status || null, passwordHash, id, tenantId]
          );
          return res.rows[0];
        });

    await this.redis.invalidateUserStatus(id);

    // Security C3: Invalidate user sessions if password was reset or account suspended
    if (dto.password || dto.status === UserStatus.SUSPENDED) {
      await this.redis.incrementUserTokenVersion(id);
    }

    return reply.send({ success: true, data: updated });
  }

  @Delete(':id')
  @RequireScope(ApiScopes.USERS_WRITE)
  @UseInterceptors(IdempotencyInterceptor)
  async deleteUser(@Param('id') id: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    const tenantId = auth.tenantId;

    // Disallow self deletion
    if (auth.userId === id) {
      return reply.status(403).send({
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'You cannot delete your own account' },
      });
    }

    // Lookup target user
    const targetCheck = auth.role === UserRoles.SUPER_ADMIN
      ? await this.db.withSuperAdminContext(async (client) => {
          const res = await client.query('SELECT id, email, role FROM users WHERE id = $1', [id]);
          return res.rows[0];
        })
      : await this.db.withTenantContext(tenantId, async (client) => {
          const res = await client.query('SELECT id, email, role FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
          return res.rows[0];
        });

    if (!targetCheck) {
      return reply.status(404).send({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' } });
    }

    const isTargetRoot = isRootSuperAdmin(targetCheck.email);

    // Check delete permission and hierarchy
    if (!canDeleteTargetUser(auth.role, targetCheck.role, isTargetRoot, false)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: isTargetRoot
            ? 'Root Super Administrator account is permanently protected and cannot be deleted'
            : 'Insufficient permissions. You can only delete users strictly below your role in hierarchy',
        },
      });
    }

    // Security M1: Handle super_admin path with SuperAdminContext (no tenant_id filter since super_admin tenant_id is null)
    if (auth.role === UserRoles.SUPER_ADMIN) {
      await this.db.withSuperAdminContext(async (client) => {
        await client.query('DELETE FROM users WHERE id = $1', [id]);
      });
    } else {
      await this.db.withTenantContext(tenantId, async (client) => {
        await client.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
      });
    }

    await this.redis.invalidateUserStatus(id);
    await this.redis.incrementUserTokenVersion(id);
    return reply.send({ success: true, message: 'User deleted successfully' });
  }
}
