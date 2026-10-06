import { Controller, Post, Get, Patch, Req, Res, Body, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AuthGuard, Public } from '../common/guards/auth.guard.js';
import { env } from '../config/env.js';
import { ROLE_SCOPES, UserRoleType, ErrorCodes, validatePasswordStrength } from '../constants/index.js';

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
    nonce: z.string().optional(),
    state: z.string().optional(),
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
  async login(@Body() body: unknown, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const geoUa = (req as any).geoUa;
    const clientIp = (env.TRUST_PROXY ? geoUa?.clientIp : req.ip) || req.ip || '127.0.0.1';

    // Security C1: Pre-flight check for active IP lockout (15 min lockout after 5 failures)
    const ipLockoutKey = `lockout:ip:${clientIp}`;
    const isIpLocked = await this.redis.client.get(ipLockoutKey);
    if (isIpLocked) {
      const ttl = await this.redis.client.ttl(ipLockoutKey);
      return reply.status(429).send({
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: `Too many failed login attempts from this IP address. Temporarily locked out for ${Math.max(1, Math.ceil(ttl / 60))} minute(s).`,
        },
      });
    }

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
    const normalizedEmail = email.toLowerCase().trim();

    // Security C1: Pre-flight check for active Email lockout (prevents distributed password guessing)
    const emailLockoutKey = `lockout:email:${normalizedEmail}`;
    const isEmailLocked = await this.redis.client.get(emailLockoutKey);
    if (isEmailLocked) {
      const ttl = await this.redis.client.ttl(emailLockoutKey);
      return reply.status(429).send({
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: `Too many failed login attempts for this account. Temporarily locked out for ${Math.max(1, Math.ceil(ttl / 60))} minute(s).`,
        },
      });
    }

    const recordFailedAttempt = async () => {
      const ipFailKey = `login:fail:ip:${clientIp}`;
      const emailFailKey = `login:fail:email:${normalizedEmail}`;

      const ipFails = await this.redis.client.incr(ipFailKey);
      if (ipFails === 1) await this.redis.client.expire(ipFailKey, 60);

      const emailFails = await this.redis.client.incr(emailFailKey);
      if (emailFails === 1) await this.redis.client.expire(emailFailKey, 60);

      if (ipFails >= 5) {
        await this.redis.client.setex(ipLockoutKey, 900, '1'); // 15-min lockout
      }
      if (emailFails >= 5) {
        await this.redis.client.setex(emailLockoutKey, 900, '1'); // 15-min lockout
      }
    };

    // Check user in database using system context
    const userResult = await this.db.withSuperAdminContext(async (client) => {
      return client.query(
        `SELECT id, tenant_id, name, email, password_hash, role, status FROM users WHERE LOWER(email) = LOWER($1)`,
        [normalizedEmail]
      );
    });

    if (userResult.rowCount === 0) {
      await recordFailedAttempt();
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
      await recordFailedAttempt();
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Invalid email or password',
        },
      });
    }

    // Reset failed attempt counters upon successful authentication
    await this.redis.client.del(`login:fail:ip:${clientIp}`);
    await this.redis.client.del(`login:fail:email:${normalizedEmail}`);

    // Update last_login_at and status to active if was invited
    await this.db.withSuperAdminContext(async (client) => {
      return client.query(
        `UPDATE users SET last_login_at = NOW(), status = 'active' WHERE id = $1`,
        [user.id]
      );
    });

    const scopes = ROLE_SCOPES[user.role as UserRoleType] || [];
    const tokenVer = await this.redis.getUserTokenVersion(user.id);

    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      scopes,
      ver: tokenVer,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRY as any,
    });

    // Optionally get tenant name
    let tenantName: string | null = null;
    let tenantCode: string | null = null;
    if (user.tenant_id) {
      const tenantRes = await this.db.withSuperAdminContext(async (client) => {
        return client.query(
          `SELECT name, code FROM tenants WHERE id = $1`,
          [user.tenant_id]
        );
      });
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

    // 1. Fail-closed: Google OAuth MUST be configured
    if (!env.GOOGLE_CLIENT_ID) {
      return reply.status(503).send({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Google OAuth authentication is not configured on the server (GOOGLE_CLIENT_ID missing)',
        },
      });
    }

    const { credential, idToken, code, redirectUri, nonce, state } = parseResult.data;
    let tokenToVerify = credential || idToken;

    const oauthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

    // 2. Exchange authorization code if provided
    if (code) {
      if (!env.GOOGLE_CLIENT_SECRET) {
        return reply.status(503).send({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: 'Google OAuth client secret is not configured on the server',
          },
        });
      }

      try {
        const tokenResponse = await oauthClient.getToken({
          code,
          redirect_uri: redirectUri || '',
        });
        tokenToVerify = tokenResponse.tokens.id_token || undefined;
      } catch (err: any) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ErrorCodes.UNAUTHORIZED,
            message: `Failed to exchange Google authorization code: ${err.message}`,
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

    // 3. Local cryptographic JWKS signature & claims verification using google-auth-library
    let googlePayload: any;
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken: tokenToVerify,
        audience: env.GOOGLE_CLIENT_ID,
      });
      googlePayload = ticket.getPayload();
      if (!googlePayload) {
        throw new Error('Google token payload is empty');
      }
    } catch (verifyErr: any) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: `Invalid or expired Google token: ${verifyErr.message}`,
        },
      });
    }

    // 4. Verify nonce (Security H1: Strict Replay attack & token injection mitigation)
    if (nonce) {
      if (!googlePayload.nonce || googlePayload.nonce !== nonce) {
        return reply.status(401).send({
          success: false,
          error: {
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Google token nonce mismatch. Replay or injection attempt rejected.',
          },
        });
      }
    }

    // 5. Verify email claim
    if (!googlePayload.email || !googlePayload.email_verified) {
      return reply.status(401).send({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Google account email is not verified',
        },
      });
    }

    const email = String(googlePayload.email).toLowerCase();
    const googleId = String(googlePayload.sub);
    const avatarUrl = googlePayload.picture ? String(googlePayload.picture) : null;

    // 6. Strict Multi-Tenant isolation & system user check (No stranger auto-provisioning)
    const authResult = await this.db.withSuperAdminContext(async (client) => {
      const userRes = await client.query(
        `SELECT id, tenant_id, name, email, role, status, google_id, avatar_url FROM users WHERE LOWER(email) = LOWER($1)`,
        [email]
      );

      if (userRes.rowCount === 0) {
        return { notFound: true };
      }

      const existingUser = userRes.rows[0];

      if (existingUser.status === 'suspended') {
        return { suspended: true };
      }

      // Activate invited user, update last_login_at and Google metadata
      const updatedRes = await client.query(
        `UPDATE users 
         SET last_login_at = NOW(), 
             status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
             google_id = COALESCE(google_id, $2), 
             avatar_url = COALESCE($3, avatar_url) 
         WHERE id = $1 
         RETURNING id, tenant_id, name, email, role, status, avatar_url`,
        [existingUser.id, googleId, avatarUrl]
      );

      let tenantName: string | null = null;
      let tenantCode: string | null = null;
      if (existingUser.tenant_id) {
        const tenantRes = await client.query(
          `SELECT name, code FROM tenants WHERE id = $1`,
          [existingUser.tenant_id]
        );
        if (tenantRes.rowCount && tenantRes.rowCount > 0) {
          tenantName = tenantRes.rows[0].name;
          tenantCode = tenantRes.rows[0].code;
        }
      }

      return { user: updatedRes.rows[0], tenantName, tenantCode };
    });

    // Security H2: Prevent email enumeration via generic refusal message
    if (authResult.notFound) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'This Google account cannot access Shortly. Please contact your organization administrator for an invitation.',
        },
      });
    }

    if (authResult.suspended) {
      return reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Account is suspended. Please contact administrator.',
        },
      });
    }

    const user = authResult.user!;

    // Check tenant suspension status if user is scoped to a tenant
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

    const scopes = ROLE_SCOPES[user.role as UserRoleType] || [];
    const tokenVer = await this.redis.getUserTokenVersion(user.id);
    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      name: user.name,
      email: user.email,
      role: user.role,
      scopes,
      ver: tokenVer,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRY as any,
    });

    return reply.status(200).send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          avatar_url: avatarUrl || user.avatar_url,
          tenant_id: user.tenant_id,
          tenant_name: authResult.tenantName,
          tenant_code: authResult.tenantCode,
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

    const userRes = await this.db.withSuperAdminContext(async (client) => {
      return client.query(
        `SELECT id, tenant_id, name, email, role, status, last_login_at, created_at FROM users WHERE id = $1`,
        [auth.userId]
      );
    });

    if (userRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' },
      });
    }

    const user = userRes.rows[0];
    let tenant = null;
    if (user.tenant_id) {
      const tenantRes = await this.db.withSuperAdminContext(async (client) => {
        return client.query(
          `SELECT id, code, name, plan_id, status FROM tenants WHERE id = $1`,
          [user.tenant_id]
        );
      });
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
  @Patch('profile')
  async updateProfile(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      return reply.status(401).send({
        success: false,
        error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' },
      });
    }

    const schema = z.object({
      name: z.string().min(2).max(255).optional(),
      avatar_url: z.string().max(2000).optional().nullable(),
    });

    const body = schema.parse(req.body);

    const updated = await this.db.withSuperAdminContext(async (client) => {
      const res = await client.query(
        `UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, role, status, avatar_url, updated_at`,
        [body.name || null, body.avatar_url !== undefined ? body.avatar_url : null, auth.userId]
      );
      return res.rows[0];
    });

    await this.redis.invalidateUserStatus(auth.userId);
    return reply.send({ success: true, data: updated });
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  async changePassword(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      return reply.status(401).send({
        success: false,
        error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' },
      });
    }

    const schema = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    // Security H4: Validate password strength against common patterns
    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return reply.status(400).send({
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: strengthCheck.message || 'Password does not meet complexity requirements',
        },
      });
    }

    const userRes = await this.db.withSuperAdminContext(async (client) => {
      return client.query(`SELECT password_hash FROM users WHERE id = $1`, [auth.userId]);
    });

    if (userRes.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' },
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return reply.status(400).send({
        success: false,
        error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Current password does not match' },
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await this.db.withSuperAdminContext(async (client) => {
      return client.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, auth.userId]);
    });

    // Security C3: Invalidate all existing JWT sessions upon password change
    await this.redis.incrementUserTokenVersion(auth.userId);

    return reply.send({ success: true, message: 'Password updated successfully' });
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
