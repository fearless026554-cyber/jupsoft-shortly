import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as crypto from 'node:crypto';
import { env } from '../config/env.js';
import { DB_CONTEXT_KEYS } from '../constants/index.js';

import bcrypt from 'bcryptjs';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  public pool: Pool;

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
    await this.initSeed();
  }

  private async initSeed() {
    try {
      const tenantCode = env.SEED_TENANT_CODE;
      const tenantName = env.SEED_TENANT_NAME;
      const adminEmail = env.SEED_ADMIN_EMAIL;

      // Only run bootstrap seed when explicitly configured via env
      if (!tenantCode || !tenantName) {
        return;
      }

      // 1. Ensure configured initial tenant exists
      const tenantRes = await this.pool.query(
        `SELECT id FROM tenants WHERE code = $1 LIMIT 1`,
        [tenantCode]
      );
      let tenantId = tenantRes.rows[0]?.id;
      if (!tenantId) {
        const seedTenantId = env.SEED_TENANT_ID || crypto.randomUUID();
        const insertTenant = await this.pool.query(
          `INSERT INTO tenants (id, code, name, status, plan_id)
           VALUES ($1, $2, $3, 'active', 'internal_unlimited')
           ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [seedTenantId, tenantCode, tenantName]
        );
        tenantId = insertTenant.rows[0]?.id || seedTenantId;
      }

      // 2. Ensure configured initial super admin user exists
      if (!adminEmail) {
        return;
      }

      const userRes = await this.pool.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [adminEmail]
      );

      if (userRes.rowCount === 0) {
        const generatedRandom = !env.SEED_ADMIN_PASSWORD;
        const seedPassword =
          env.SEED_ADMIN_PASSWORD || crypto.randomBytes(16).toString('base64url');
        const adminName = env.SEED_ADMIN_NAME || 'System Administrator';
        const hash = bcrypt.hashSync(seedPassword, 10);

        await this.pool.query(
          `INSERT INTO users (tenant_id, name, email, password_hash, role, status)
           VALUES ($1, $2, $3, $4, 'super_admin', 'active')`,
          [tenantId, adminName, adminEmail, hash]
        );
        if (generatedRandom && env.NODE_ENV !== 'production') {
          console.log(
            `[Seed] Seeded initial super admin (${adminEmail}) with one-time generated password: ${seedPassword}`
          );
        } else {
          console.log(`[Seed] Seeded initial super admin user: ${adminEmail}`);
        }
      }
    } catch (err) {
      console.warn('[Seed] Warning during database init seed:', err);
    }
  }

  async onModuleDestroy() {
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
