import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { env } from '../config/env.js';
import { DB_CONTEXT_KEYS } from '../constants/index.js';
import { RetentionService } from '../services/retention.service.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  public pool: Pool;
  private retentionTimer: NodeJS.Timeout | null = null;

  async onModuleInit() {
    this.pool = new Pool({
      host: env.PG_HOST,
      port: env.PG_PORT,
      database: env.PG_DATABASE,
      user: env.PG_USER,
      password: env.PG_PASSWORD,
      max: env.PG_POOL_MAX,
      idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: env.PG_CONN_TIMEOUT_MS,
    });

    // Ensure upcoming click partitions on startup
    try {
      await RetentionService.ensureUpcomingPartitions(this.pool);
    } catch (err: any) {
      console.warn('[DatabaseService] Partition provisioning notice:', err.message);
    }

    // Schedule 24h recurring retention maintenance
    this.retentionTimer = setInterval(async () => {
      try {
        await RetentionService.ensureUpcomingPartitions(this.pool);
        await RetentionService.purgeExpiredPartitions(this.pool);
      } catch (err: any) {
        console.error('[DatabaseService] Retention maintenance failed:', err.message);
      }
    }, 24 * 3600 * 1000);
  }

  async onModuleDestroy() {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }
    await this.pool.end();
  }

  async withTenantContext<T>(
    tenantId: string,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('${DB_CONTEXT_KEYS.TENANT_ID}', $1, true)`, [tenantId]);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async withSuperAdminContext<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('${DB_CONTEXT_KEYS.IS_SUPER_ADMIN}', 'true', true)`);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
