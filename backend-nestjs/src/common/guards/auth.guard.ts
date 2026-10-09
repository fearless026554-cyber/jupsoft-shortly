import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import * as crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../../db/database.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { env } from '../../config/env.js';
import { AUTH_CONSTANTS, CACHE_TTL, ErrorCodes, HeaderNames, RedisKeyBuilder, REDIS_KEYS, ApiScopes, ROLE_SCOPES } from '../../constants/index.js';

export const SCOPES_KEY = 'scopes';
export const RequireScope = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse();

    const authHeader = request.headers['authorization'] as string | undefined;
    const xApiKey = request.headers[HeaderNames.X_API_KEY] as string | undefined;

    let bearerToken: string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    } else if (authHeader && !xApiKey) {
      bearerToken = authHeader.trim();
    }

    let authData: any = null;

    // 1. Try JWT verification if bearer token resembles a JWT (three period-separated segments)
    if (bearerToken && bearerToken.split('.').length === 3) {
      try {
        const tokenHash = crypto.createHash('sha256').update(bearerToken).digest('hex');
        const isRevoked = await this.redis.client.get(`auth:revoked:${tokenHash}`);
        if (isRevoked) {
          reply.status(401).send({
            success: false,
            error: {
              code: ErrorCodes.UNAUTHORIZED,
              message: 'Session has been revoked or logged out',
            },
          });
          return false;
        }

        const decoded = jwt.verify(bearerToken, env.JWT_SECRET) as any;

        // Security C3: Session Versioning Check (invalidates all sessions upon password reset)
        if (decoded && decoded.userId) {
          const currentVer = await this.redis.getUserTokenVersion(decoded.userId);
          const tokenVer = typeof decoded.ver === 'number' ? decoded.ver : 0;
          if (tokenVer < currentVer) {
            reply.status(401).send({
              success: false,
              error: {
                code: ErrorCodes.UNAUTHORIZED,
                message: 'Session has expired or was invalidated due to a security update. Please log in again.',
              },
            });
            return false;
          }
        }

        const scopes = decoded.scopes || (decoded.role ? (ROLE_SCOPES as any)[decoded.role] : []) || [];
        authData = {
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
          scopes: Array.isArray(scopes) ? scopes : [],
          isJwt: true,
        };
      } catch (jwtErr: any) {
        reply.status(401).send({
          success: false,
          error: {
            code: ErrorCodes.UNAUTHORIZED,
            message: jwtErr.name === 'TokenExpiredError' ? 'Session token has expired' : 'Invalid session token',
          },
        });
        return false;
      }
    }

    // 2. Fallback to API Key verification (Security H3: Only accept via X-API-Key header or Bearer token, never query string)
    if (!authData) {
      const apiKey = xApiKey || (bearerToken && !bearerToken.includes('.') ? bearerToken : undefined);
      if (!apiKey) {
        reply.status(401).send({
          success: false,
          error: {
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Authentication required. Please provide a Bearer token or X-API-Key header.',
          },
        });
        return false;
      }

      const keyHash = crypto.createHash(AUTH_CONSTANTS.HASH_ALGO).update(apiKey).digest('hex');
      const cacheKey = RedisKeyBuilder.authKey(keyHash);
      const cachedAuth = await this.redis.client.get(cacheKey);

      if (cachedAuth) {
        authData = JSON.parse(cachedAuth);
        if (authData.expiresAt && new Date(authData.expiresAt) < new Date()) {
          await this.redis.client.del(cacheKey);
          reply.status(403).send({
            success: false,
            error: {
              code: ErrorCodes.KEY_EXPIRED,
              message: 'The provided API key has expired',
            },
          });
          return false;
        }
      } else {
        const res = await this.db.withSuperAdminContext(async (client) => {
          return client.query(
            `SELECT id, tenant_id, scopes, revoked_at, expires_at FROM api_keys WHERE key_hash = $1`,
            [keyHash]
          );
        });

        if (res.rowCount === 0) {
          reply.status(401).send({
            success: false,
            error: { code: ErrorCodes.INVALID_API_KEY, message: 'The provided API key is invalid' },
          });
          return false;
        }

        const keyRecord = res.rows[0];

        if (keyRecord.revoked_at) {
          reply.status(403).send({
            success: false,
            error: { code: ErrorCodes.KEY_REVOKED, message: 'The provided API key has been revoked' },
          });
          return false;
        }

        if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
          reply.status(403).send({
            success: false,
            error: { code: ErrorCodes.KEY_EXPIRED, message: 'The provided API key has expired' },
          });
          return false;
        }

        authData = {
          tenantId: keyRecord.tenant_id,
          keyId: keyRecord.id,
          scopes: keyRecord.scopes || [],
          expiresAt: keyRecord.expires_at || null,
        };

        await Promise.all([
          this.redis.client.setex(cacheKey, CACHE_TTL.AUTH_SESSION_SEC, JSON.stringify(authData)),
          this.redis.client.setex(REDIS_KEYS.API_KEY_HASH_TO_ID(keyHash), CACHE_TTL.AUTH_SESSION_SEC, keyRecord.id),
        ]);
        this.db.withSuperAdminContext(async (client) => {
          return client.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [keyRecord.id]);
        }).catch(() => {});
      }
    }

    (request as any).auth = authData;

    // Check User Account Status
    if (authData.userId) {
      const userStatus = await this.redis.getUserStatus(authData.userId);
      if (userStatus === 'suspended') {
        reply.status(403).send({
          success: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: 'Your account has been suspended. Please contact administrator.',
          },
        });
        return false;
      }
    }

    // Check Tenant Organization Status
    if (authData.tenantId && authData.role !== 'super_admin') {
      const tenantStatus = await this.redis.getTenantStatus(authData.tenantId);
      (request as any).tenantStatus = tenantStatus;
      if (tenantStatus === 'suspended') {
        reply.status(403).send({
          success: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: 'Your organization account is currently suspended.',
          },
        });
        return false;
      }
    }

    // Check Scopes
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes || requiredScopes.length === 0) {
      return true; // No specific scopes required, just auth
    }

    const scopes = authData.scopes;
    const scope = requiredScopes[0]; // Usually just one scope is checked
    const isTenantPlatformScope = scope.startsWith('tenants:');

    let hasPermission = false;
    if (authData.role === 'super_admin' || scopes.includes(ApiScopes.SUPER_ADMIN) || scopes.includes(ApiScopes.WILDCARD)) {
      hasPermission = true;
    } else if (isTenantPlatformScope) {
      hasPermission =
        (!authData.tenantId && scopes.includes(ApiScopes.WILDCARD)) ||
        scopes.includes(scope);
    } else {
      hasPermission =
        scopes.includes(ApiScopes.ADMIN) ||
        scopes.includes(scope);
    }

    if (!hasPermission) {
      reply.status(403).send({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: `Insufficient permissions. Required scope: '${scope}'`,
        },
      });
      return false;
    }

    return true;
  }
}
