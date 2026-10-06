import { Controller, Post, Get, Req, Res, Body, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, Public } from '../common/guards/auth.guard.js';
import { env } from '../config/env.js';
import { ROLE_SCOPES, UserRoleType, ErrorCodes } from '../constants/index.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z
  .object({
    credential: z.string().optional(),
    idToken: z.string().optional(),
    code: z.string().optional(),
    redirectUri: z.string().optional(),
  })
  .refine((data) => data.credential || data.idToken || data.code, {
    message: 'Google credential (idToken) or authorization code is required',
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

  @Public()
  @Get('google/config')
  async getGoogleConfig(@Res() reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      data: {
        enabled: Boolean(env.GOOGLE_CLIENT_ID),
        clientId: env.GOOGLE_CLIENT_ID || null,
      },
    });
  }

  @Public()
  @Post('google')
  async googleLogin(@Body() body: unknown, @Res() reply: FastifyReply) {
    const parseResult = googleAuthSchema.safeParse(body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid Google login request parameters',
          details: parseResult.error.issues,
        },
      });
    }

    const { credential, idToken, code, redirectUri } = parseResult.data;
    let tokenToVerify = credential || idToken;

    if (code) {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return reply.status(500).send({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: 'Google OAuth client credentials are not configured on the server',
          },
        });
      }

      const params = new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri || '',
        grant_type: 'authorization_code',
      });

      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (!tokenRes.ok) {
          const errData: any = await tokenRes.json().catch(() => ({}));
          return reply.status(401).send({
            success: false,
            error: {
              code: ErrorCodes.UNAUTHORIZED,
              message: errData.error_description || 'Failed to exchange Google authorization code',
            },
          });
        }

        const tokenData: any = await tokenRes.json();
        tokenToVerify = tokenData.id_token;
      } catch (err: any) {
        return reply.status(502).send({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: `Failed to contact Google OAuth token endpoint: ${err.message}`,
          },
        });
      }
    }

    if (!tokenToVerify) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Google ID token could not be obtained',
        },
      });
    }

    // Verify token with Google tokeninfo endpoint
    let googlePayload: any;
    try {
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`
      );

      if (!verifyRes.ok) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Invalid or expired Google token',
          },
        });
      }

      googlePayload = await verifyRes.json();
    } catch (err: any) {
      return reply.status(502).send({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: `Failed to verify token with Google: ${err.message}`,
        },
      });
    }

    // Validate claims from Google
    if (!googlePayload.email || (googlePayload.email_verified !== 'true' && googlePayload.email_verified !== true)) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Google account email is not verified',
        },
      });
    }

    if (env.GOOGLE_CLIENT_ID && googlePayload.aud !== env.GOOGLE_CLIENT_ID) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Google token audience does not match configured GOOGLE_CLIENT_ID',
        },
      });
    }

    const email = String(googlePayload.email).toLowerCase();
    const name = String(googlePayload.name || googlePayload.given_name || email.split('@')[0]);
    const googleId = String(googlePayload.sub);
    const avatarUrl = googlePayload.picture ? String(googlePayload.picture) : null;

    // Check if user exists in database
    const userRes = await this.db.pool.query(
      `SELECT id, tenant_id, name, email, role, status, google_id, avatar_url FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    let user;
    if (userRes.rowCount && userRes.rowCount > 0) {
      user = userRes.rows[0];

      if (user.status === 'suspended') {
        return reply.status(403).send({
          success: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: 'Account is suspended. Please contact administrator.',
          },
        });
      }

      // Check tenant status if assigned
      if (user.tenant_id) {
        const tenantStatus = await this.redis.getTenantStatus(user.tenant_id);
        if (tenantStatus === 'suspended' || tenantStatus === 'archived') {
          return reply.status(403).send({
            success: false,
            error: {
              code: ErrorCodes.FORBIDDEN,
              message: 'Organization is inactive or suspended. Please contact administrator.',
            },
          });
        }
      }

      // Update user details
      await this.db.pool.query(
        `UPDATE users SET last_login_at = NOW(), status = 'active', google_id = COALESCE(google_id, $2), avatar_url = COALESCE($3, avatar_url) WHERE id = $1`,
        [user.id, googleId, avatarUrl]
      );
    } else {
      // Find default active tenant for auto-provisioning
      const tenantRes = await this.db.pool.query(
        `SELECT id FROM tenants WHERE code = 'jupsoft' OR status = 'active' ORDER BY created_at ASC LIMIT 1`
      );
      const defaultTenantId = tenantRes.rows[0]?.id || '11111111-1111-1111-1111-111111111111';

      const newUserRes = await this.db.pool.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, status, google_id, avatar_url, last_login_at)
         VALUES ($1, $2, $3, $4, 'user', 'active', $5, $6, NOW())
         RETURNING id, tenant_id, name, email, role, status, google_id, avatar_url`,
        [defaultTenantId, name, email, 'oauth:google', googleId, avatarUrl]
      );
      user = newUserRes.rows[0];
    }

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
          avatar_url: avatarUrl || user.avatar_url,
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
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await this.redis.client.setex(`auth:revoked:${tokenHash}`, 7 * 86400, '1');
    }
    return reply.status(200).send({
      success: true,
      message: 'Successfully logged out',
    });
  }
}
