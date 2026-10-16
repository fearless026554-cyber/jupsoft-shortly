import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { LinkService } from '../services/link.service.js';
import { AuditService } from '../services/audit.service.js';
import { DB_CONTEXT_KEYS, QueueNames, JobNames } from '../constants/index.js';
import { BulkLinkJobData } from '../types/index.js';
import { env } from '../config/env.js';

@Processor(QueueNames.BULK_LINKS, { concurrency: 2 })
export class BulkProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<BulkLinkJobData, any, string>): Promise<any> {
    if (job.name === JobNames.PROCESS_BULK_LINKS) {
      const { tenantId, domainId, links } = job.data;
      const total = links.length;
      if (total === 0) {
        return { total: 0, completed: 0, failed: 0, results: [] };
      }

      const startTime = Date.now();
      let completed = 0;
      let failed = 0;
      let processedCount = 0;
      const results: Array<{ externalRef?: string; destinationUrl: string; shortUrl?: string; error?: string }> = new Array(total);
      const createdForCache: Array<{ domainId: string; code: string; cached: any }> = [];

      // 1. Pre-query tenant code once to eliminate 500 redundant SELECT queries
      let tenantCode: string | undefined;
      try {
        const tRes = await this.db.pool.query('SELECT code FROM tenants WHERE id = $1', [tenantId]);
        tenantCode = tRes.rows[0]?.code;
      } catch (err: any) {
        this.logger.warn(`Could not resolve tenant code for tenant ${tenantId}: ${err.message}`);
      }

      // 2. High-performance concurrent worker pool (scaled to pool capacity)
      const maxPool = env.PG_POOL_MAX || 20;
      const concurrency = Math.min(10, Math.max(2, Math.floor(maxPool / 2)));
      let nextIndex = 0;

      const workerTask = async (workerId: number) => {
        let client;
        try {
          client = await this.db.pool.connect();
          await client.query('BEGIN');
          await client.query(`SELECT set_config('${DB_CONTEXT_KEYS.TENANT_ID}', $1, true)`, [tenantId]);

          while (true) {
            const i = nextIndex++;
            if (i >= total) break;

            const item = links[i];
            const itemDomainId = item.domainId || domainId;

            try {
              await client.query('SAVEPOINT sp_bulk_item');

              const created = await LinkService.createLink(
                client,
                tenantId,
                {
                  destinationUrl: item.destinationUrl,
                  alias: item.alias,
                  tag: item.tag,
                  externalRef: item.externalRef,
                  expiresAt: item.expiresAt,
                },
                itemDomainId,
                {
                  skipQr: true,
                  tenantCode,
                }
              );

              await client.query('RELEASE SAVEPOINT sp_bulk_item');

              const actualCode = (created.link as any).short_code || created.link.shortCode;
              createdForCache.push({
                domainId: itemDomainId,
                code: actualCode,
                cached: LinkService.toCachedLink(created.link),
              });

              results[i] = {
                externalRef: item.externalRef,
                destinationUrl: item.destinationUrl,
                shortUrl: created.shortUrl,
              };
              completed++;
            } catch (err: any) {
              await client.query('ROLLBACK TO SAVEPOINT sp_bulk_item').catch(() => {});
              results[i] = {
                externalRef: item.externalRef,
                destinationUrl: item.destinationUrl,
                error: err.message || 'Creation failed',
              };
              failed++;
            }

            processedCount++;
            if (processedCount % 25 === 0 || processedCount === total) {
              await job.updateProgress(Math.round((processedCount / total) * 100)).catch(() => {});
            }
          }

          await client.query('COMMIT');
        } catch (workerFatalErr: any) {
          if (client) {
            await client.query('ROLLBACK').catch(() => {});
          }
          this.logger.error(`Bulk worker ${workerId} encountered unexpected error: ${workerFatalErr.message}`);
        } finally {
          if (client) {
            client.release();
          }
        }
      };

      // Launch concurrent workers
      const workers = Array.from({ length: concurrency }, (_, id) => workerTask(id + 1));
      await Promise.all(workers);

      // 3. Batch cache warm-up via Redis Pipeline (1 network trip instead of 500)
      if (createdForCache.length > 0) {
        try {
          const pipeline = this.redis.client.pipeline();
          for (const item of createdForCache) {
            const cacheKey = `link:${item.domainId}:${item.code}`;
            pipeline.set(cacheKey, JSON.stringify(item.cached), 'EX', 86400);
          }
          await pipeline.exec();
        } catch (cacheErr: any) {
          this.logger.warn(`Redis pipeline cache warming error: ${cacheErr.message}`);
        }
      }

      // 4. Consolidate into 1 job-level audit record
      const auditClient = await this.db.pool.connect();
      try {
        await auditClient.query('BEGIN');
        await auditClient.query(`SELECT set_config('${DB_CONTEXT_KEYS.TENANT_ID}', $1, true)`, [tenantId]);
        await AuditService.log(auditClient, {
          tenantId,
          actorType: 'system',
          action: 'bulk.process',
          entity: 'bulk_jobs',
          entityId: job.id || job.data.jobId,
          afterState: { total, completed, failed, durationMs: Date.now() - startTime },
        });
        await auditClient.query('COMMIT');
      } catch (auditErr: any) {
        await auditClient.query('ROLLBACK').catch(() => {});
        this.logger.warn(`Bulk audit logging notice: ${auditErr.message}`);
      } finally {
        auditClient.release();
      }

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(
        `[BulkProcessor] Completed ${completed}/${total} links in ${elapsedSec}s with concurrency ${concurrency} (failed: ${failed})`
      );

      return {
        total,
        completed,
        failed,
        results,
      };
    }
  }
}
