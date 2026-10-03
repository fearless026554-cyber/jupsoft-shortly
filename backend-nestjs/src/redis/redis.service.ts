import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import * as crypto from 'node:crypto';
import { env } from '../config/env.js';
import {
  AUTH_CONSTANTS,
  CACHE_TTL,
  REDIS_CONFIG,
  RedisKeyBuilder,
  TenantStatus,
} from '../constants/index.js';
import { CachedLink, Domain } from '../types/index.js';
import { DatabaseService } from '../db/database.service.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client: Redis;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * REDIS_CONFIG.RETRY_BASE_MS, REDIS_CONFIG.RETRY_CAP_MS),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async getCachedLink(domainId: string, shortCode: string): Promise<CachedLink | null> {
    const raw = await this.client.get(RedisKeyBuilder.link(domainId, shortCode));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedLink;
    } catch {
      return null;
    }
  }

  async setCachedLink(
    domainId: string,
    shortCode: string,
    link: CachedLink,
    ttl = env.CACHE_LINK_TTL_SEC
  ): Promise<void> {
    await this.client.setex(RedisKeyBuilder.link(domainId, shortCode), ttl, JSON.stringify(link));
  }

  async invalidateLink(
    domainId: string,
    shortCode: string,
    tenantId?: string,
    alias?: string | null
  ): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.del(RedisKeyBuilder.link(domainId, shortCode));
    pipeline.del(RedisKeyBuilder.linkClicks(domainId, shortCode));
    if (tenantId && alias) {
      pipeline.del(RedisKeyBuilder.alias(tenantId, alias));
    }
    await pipeline.exec();
  }

  async getDomainByHostname(hostname: string): Promise<Domain> {
    const cacheKey = RedisKeyBuilder.domain(hostname);
    const cached = await this.client.get(cacheKey);

    if (cached) {
      try {
        const d = JSON.parse(cached);
        if (d.id) return d as Domain;
      } catch {}
    }

    const res = await this.db.pool.query(
      `SELECT id, type, tenant_id FROM domains WHERE hostname = $1 AND verification_status = 'verified'`,
      [hostname]
    );

    let domainRecord: Domain;

    if (res.rowCount && res.rowCount > 0) {
      domainRecord = {
        id: res.rows[0].id,
        type: res.rows[0].type,
        tenantId: res.rows[0].tenant_id,
      } as Domain;
    } else {
      const defaultRes = await this.db.pool.query(
        `SELECT id, type, tenant_id FROM domains WHERE id = $1`,
        [env.DEFAULT_DOMAIN_ID]
      );
      domainRecord = (defaultRes.rows[0] as Domain) || { id: env.DEFAULT_DOMAIN_ID, type: 'internal', tenantId: null };
    }

    await this.client.setex(cacheKey, CACHE_TTL.DOMAIN_METADATA_SEC, JSON.stringify(domainRecord));
    return domainRecord;
  }

  async getTenantStatus(tenantId: string): Promise<string> {
    const key = RedisKeyBuilder.tenantStatus(tenantId);
    const cached = await this.client.get(key);
    if (cached) return cached;

    const res = await this.db.pool.query('SELECT status FROM tenants WHERE id = $1', [tenantId]);
    const status = res.rows[0]?.status || TenantStatus.ACTIVE;
    await this.client.setex(key, env.CACHE_TENANT_TTL_SEC, status);
    return status;
  }

  async invalidateTenantStatus(tenantId: string): Promise<void> {
    await this.client.del(RedisKeyBuilder.tenantStatus(tenantId));
  }

  async getDailySalt(dateStr: string): Promise<string> {
    const key = RedisKeyBuilder.visitorSalt(dateStr);
    const newSalt = crypto.randomBytes(AUTH_CONSTANTS.VISITOR_SALT_BYTES).toString('hex');
    const res = await this.client.set(key, newSalt, 'EX', CACHE_TTL.VISITOR_SALT_SEC, 'NX');
    if (res === 'OK') return newSalt;
    const existing = await this.client.get(key);
    return existing || newSalt;
  }
}
