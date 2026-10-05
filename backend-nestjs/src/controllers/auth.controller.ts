import { Controller, Post, Get, Req, Res, Body, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, Public } from '../common/guards/auth.guard.js';
import { env } from '../config/env.js';
import { ROLE_SCOPES, UserRoleType, ErrorCodes } from '../constants/index.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: unknown, @Res() reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid email or password format',
          details: parseResult.error.issues,
        },
      });
    }

    const { email, password } = parseResult.data;

    // Check user in database
    const userResult = await this.db.pool.query(
      `SELECT id, tenant_id, name, email, password_hash, role, status FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    if (userResult.rowCount === 0) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Invalid email or password',
        },
      });
    }

    const user = userResult.rows[0];

    if (user.status === 'suspended') {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Account is suspended. Please contact administrator.',
        },
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Invalid email or password',
        },
      });
    }

    // Update last_login_at and status to active if was invited
    await this.db.pool.query(
      `UPDATE users SET last_login_at = NOW(), status = 'active' WHERE id = $1`,
      [user.id]
    );

    const scopes = ROLE_SCOPES[user.role as UserRoleType] || [];

    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      scopes,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRY as any,
    });

    // Optionally get tenant name
    let tenantName: string | null = null;
    let tenantCode: string | null = null;
    if (user.tenant_id) {
      const tenantRes = await this.db.pool.query(
        `SELECT name, code FROM tenants WHERE id = $1`,
        [user.tenant_id]
      );
      if (tenantRes.rowCount && tenantRes.rowCount > 0) {
        tenantName = tenantRes.rows[0].name;
        tenantCode = tenantRes.rows[0].code;
      }
    }

    return reply.status(200).send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: 'active',
          tenant_id: user.tenant_id,
          tenant_name: tenantName,
          tenant_code: tenantCode,
        },
      },
    });
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    if (!auth || !auth.userId) {
      // If auth was via API key instead of user session
      return reply.send({
        success: true,
        data: {
          type: 'api_key',
          tenantId: auth?.tenantId,
          scopes: auth?.scopes,
        },
      });
    }

    const userRes = await this.db.pool.query(
      `SELECT id, tenant_id, name, email, role, status, last_login_at, created_at FROM users WHERE id = $1`,
      [auth.userId]
    );

    if (userRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' },
      });
    }

    const user = userRes.rows[0];
    let tenant = null;
    if (user.tenant_id) {
      const tenantRes = await this.db.pool.query(
        `SELECT id, code, name, plan_id, status FROM tenants WHERE id = $1`,
        [user.tenant_id]
      );
      if (tenantRes.rowCount && tenantRes.rowCount > 0) {
        tenant = tenantRes.rows[0];
      }
    }

    return reply.send({
      success: true,
      data: {
        user,
        tenant,
        scopes: auth.scopes,
      },
    });
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return reply.send({
      success: true,
      message: 'Successfully logged out',
    });
  }
}
