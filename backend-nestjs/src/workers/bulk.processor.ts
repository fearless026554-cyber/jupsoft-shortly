import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { LinkService } from '../services/link.service.js';
import { AuditService } from '../services/audit.service.js';
import { DB_CONTEXT_KEYS, QueueNames, BULK_CONSTANTS, JobNames } from '../constants/index.js';
import { BulkLinkJobData } from '../types/index.js';

@Processor(QueueNames.BULK_LINKS, { concurrency: 2 })
export class BulkProcessor extends WorkerHost {
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
      let completed = 0;
      let failed = 0;
      const results: Array<{ destinationUrl: string; shortUrl?: string; error?: string }> = [];

      const client = await this.db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('${DB_CONTEXT_KEYS.TENANT_ID}', $1, true)`, [tenantId]);

        for (let i = 0; i < links.length; i++) {
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
              itemDomainId
            );

            await AuditService.log(client, {
              tenantId,
              actorType: 'system',
              action: 'link.create_bulk',
              entity: 'links',
              entityId: created.link.id,
              afterState: { shortCode: created.link.shortCode, destinationUrl: created.link.destinationUrl },
            });

            await client.query('RELEASE SAVEPOINT sp_bulk_item');
            completed++;
            results.push({
              destinationUrl: item.destinationUrl,
              shortUrl: created.shortUrl,
            });

            const cached = LinkService.toCachedLink(created.link);
            const actualCode = (created.link as any).short_code || created.link.shortCode;
            await this.redis.setCachedLink(itemDomainId, actualCode, cached).catch(() => {});
          } catch (err: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_bulk_item');
            failed++;
            results.push({
              destinationUrl: item.destinationUrl,
              error: err.message || 'Creation failed',
            });
          }

          if (i % BULK_CONSTANTS.PROGRESS_INTERVAL === 0 || i === links.length - 1) {
            await job.updateProgress(Math.round(((i + 1) / total) * 100));
          }
        }

        await AuditService.log(client, {
          tenantId,
          actorType: 'system',
          action: 'bulk.process',
          entity: 'bulk_jobs',
          entityId: job.id || job.data.jobId,
          afterState: { total, completed, failed },
        });

        await client.query('COMMIT');
      } catch (fatalErr: any) {
        await client.query('ROLLBACK').catch(() => {});
        throw fatalErr;
      } finally {
        client.release();
      }

      return {
        total,
        completed,
        failed,
        results,
      };
    }
  }
}
