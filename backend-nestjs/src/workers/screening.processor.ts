import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { ScreeningService } from '../services/screening.service.js';
import { QueueNames, JobNames, LinkStatus, ScreeningVerdict, ScreeningProvider, REDIS_KEYS } from '../constants/index.js';
import { UrlScreeningJobData } from '../types/index.js';

@Processor(QueueNames.URL_SCREENING, { concurrency: 2 })
export class ScreeningProcessor extends WorkerHost {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {
    super();
  }

  async process(job: Job<UrlScreeningJobData, any, string>): Promise<any> {
    if (job.name === JobNames.SCREEN_URL) {
      const { linkId, destinationUrl } = job.data;
      const { clean, verdict } = await ScreeningService.screenUrlWithSafeBrowsing(destinationUrl);

      const client = await this.db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO screening_results (link_id, provider, verdict, checked_at) VALUES ($1, $2, $3, NOW())`,
          [linkId, ScreeningProvider.GOOGLE_SAFE_BROWSING, verdict]
        );

        if (!clean) {
          await client.query(`UPDATE links SET status = $1, updated_at = NOW() WHERE id = $2`, [LinkStatus.ARCHIVED, linkId]);
          const linkRes = await client.query('SELECT domain_id, short_code, tenant_id, alias FROM links WHERE id = $1', [linkId]);
          if (linkRes.rows.length > 0) {
            const row = linkRes.rows[0];
            await this.redis.client.del(REDIS_KEYS.LINK(row.domain_id, row.short_code));
            if (row.alias) {
              await this.redis.client.del(REDIS_KEYS.ALIAS(row.tenant_id, row.alias));
            }
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      return { verdict };
    }
  }
}
