import { Pool, PoolClient } from 'pg';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { ClickIngestJobData, BulkLinkJobData, UrlScreeningJobData, CachedLink, Domain } from './index.js';

export interface GeoUaContext {
  clientIp: string;
  userAgent: string;
  countryCode?: string;
  referrer?: string;
}

export interface AuthContext {
  tenantId: string;
  keyId: string;
  scopes: string[];
}

declare module 'fastify' {
  interface FastifyInstance {
    db: {
      pool: Pool;
      withTenantContext: <T>(tenantId: string, cb: (client: PoolClient) => Promise<T>) => Promise<T>;
      withSuperAdminContext: <T>(cb: (client: PoolClient) => Promise<T>) => Promise<T>;
    };
    redis: {
      client: Redis;
      getCachedLink: (domainId: string, shortCode: string) => Promise<CachedLink | null>;
      setCachedLink: (domainId: string, shortCode: string, link: CachedLink, ttl?: number) => Promise<void>;
      invalidateLink: (domainId: string, shortCode: string, tenantId?: string, alias?: string | null) => Promise<void>;
      getDomainByHostname: (hostname: string) => Promise<Domain>;
      getTenantStatus: (tenantId: string) => Promise<string>;
      invalidateTenantStatus: (tenantId: string) => Promise<void>;
      getDailySalt: (dateStr: string) => Promise<string>;
    };
    queues: {
      clicks: Queue<ClickIngestJobData>;
      bulk: Queue<BulkLinkJobData>;
      screening: Queue<UrlScreeningJobData>;
    };
  }

  interface FastifyRequest {
    geoUa: GeoUaContext;
    auth?: AuthContext;
  }
}
