import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  AUTH_CONSTANTS,
  DATE_CONSTANTS,
  FALLBACKS,
  QueueNames,
  UA_PATTERNS,
  JobNames,
} from '../constants/index.js';
import { ClickIngestJobData } from '../types/index.js';
import { env } from '../config/env.js';

export interface DeviceInfo {
  device: 'mobile' | 'desktop' | 'tablet' | 'bot';
  browser: string;
  os: string;
  isBot: boolean;
}

export function parseUserAgent(uaString: string): DeviceInfo {
  const ua = uaString.toLowerCase();
  if (UA_PATTERNS.BOTS.test(ua)) return { device: 'bot', browser: 'Bot', os: 'Unknown', isBot: true };

  let os = 'Other';
  if (UA_PATTERNS.ANDROID.test(ua)) os = 'Android';
  else if (UA_PATTERNS.IOS.test(ua)) os = 'iOS';
  else if (UA_PATTERNS.WINDOWS.test(ua)) os = 'Windows';
  else if (UA_PATTERNS.MACOS.test(ua)) os = 'macOS';
  else if (UA_PATTERNS.LINUX.test(ua)) os = 'Linux';

  let device: 'mobile' | 'desktop' | 'tablet' | 'bot' = 'desktop';
  if (UA_PATTERNS.TABLET.test(ua)) device = 'tablet';
  else if (UA_PATTERNS.MOBILE.test(ua)) device = 'mobile';

  let browser = 'Other';
  if (UA_PATTERNS.EDGE.test(ua)) browser = 'Edge';
  else if (UA_PATTERNS.CHROME.test(ua) && !UA_PATTERNS.EDGE.test(ua)) browser = 'Chrome';
  else if (UA_PATTERNS.SAFARI.test(ua) && !UA_PATTERNS.CHROME.test(ua)) browser = 'Safari';
  else if (UA_PATTERNS.FIREFOX.test(ua)) browser = 'Firefox';

  return { device, browser, os, isBot: false };
}

@Processor(QueueNames.CLICKS, { concurrency: env.CLICK_WORKER_CONCURRENCY })
export class ClickProcessor extends WorkerHost {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<ClickIngestJobData, any, string>): Promise<any> {
    if (job.name === JobNames.INGEST_CLICK) {
      const data = job.data;
      const clickedAt = new Date(data.clickedAt);
      const dateStr = clickedAt.toISOString().slice(0, DATE_CONSTANTS.ISO_DATE_PREFIX_LEN);

      const dailySalt = await this.redis.getDailySalt(dateStr);
      const visitorHash = crypto
        .createHmac(AUTH_CONSTANTS.HASH_ALGO, dailySalt)
        .update(`${data.ip}:${data.userAgent}`)
        .digest('hex');

      const uaInfo = parseUserAgent(data.userAgent);

      const client = await this.db.pool.connect();
      try {
        await client.query('BEGIN');

        const countryCode = data.countryCode || FALLBACKS.COUNTRY_CODE;

        const existingVisit = await client.query(
          `SELECT 1 FROM clicks WHERE link_id = $1 AND clicked_at >= $2::timestamptz AND clicked_at < ($2::timestamptz + INTERVAL '1 day') AND visitor_hash = $3 LIMIT 1`,
          [data.linkId, dateStr, visitorHash]
        );
        const isUniqueToday = existingVisit.rowCount === 0 && !uaInfo.isBot;

        await client.query(
          `INSERT INTO clicks (link_id, tenant_id, clicked_at, visitor_hash, device, browser, os, country, referrer, is_bot) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [data.linkId, data.tenantId, clickedAt, visitorHash, uaInfo.device, uaInfo.browser, uaInfo.os, countryCode, data.referrer || null, uaInfo.isBot]
        );

        if (!uaInfo.isBot) {
          const linkUpdateRes = await client.query(`UPDATE links SET click_count = click_count + 1 WHERE id = $1 RETURNING click_count, max_clicks`, [data.linkId]);
          if (linkUpdateRes.rowCount && linkUpdateRes.rowCount > 0) {
            const l = linkUpdateRes.rows[0];
            if (l.max_clicks && Number(l.click_count) >= Number(l.max_clicks)) {
              await client.query(`UPDATE links SET status = 'expired' WHERE id = $1`, [data.linkId]);
            }
          }
        }

        const deviceKey = uaInfo.device;
        const osKey = uaInfo.os;
        const browserKey = uaInfo.browser;
        const countryKey = countryCode;
        let refKey: string = FALLBACKS.REFERRER;
        if (data.referrer) {
          try {
            refKey = new URL(data.referrer).hostname || FALLBACKS.REFERRER;
          } catch {
            refKey = FALLBACKS.REFERRER;
          }
        }

        const clicksDelta = uaInfo.isBot ? 0 : 1;
        const uniqueDelta = isUniqueToday ? 1 : 0;
        const botClicksDelta = uaInfo.isBot ? 1 : 0;

        await client.query(
          `INSERT INTO click_daily (
            tenant_id, link_id, date, clicks, unique_clicks, bot_clicks,
            by_device, by_os, by_browser, by_country, by_referrer
          ) VALUES (
            $1, $2, $3, $9, $10, $11,
            jsonb_build_object($4::text, 1), jsonb_build_object($5::text, 1), jsonb_build_object($6::text, 1), jsonb_build_object($7::text, 1), jsonb_build_object($8::text, 1)
          )
          ON CONFLICT (link_id, date) DO UPDATE SET
            clicks = click_daily.clicks + $9, unique_clicks = click_daily.unique_clicks + $10, bot_clicks = click_daily.bot_clicks + $11,
            by_device = jsonb_set(click_daily.by_device, ARRAY[$4::text], to_jsonb(COALESCE((click_daily.by_device->>$4::text)::int, 0) + 1)),
            by_os = jsonb_set(click_daily.by_os, ARRAY[$5::text], to_jsonb(COALESCE((click_daily.by_os->>$5::text)::int, 0) + 1)),
            by_browser = jsonb_set(click_daily.by_browser, ARRAY[$6::text], to_jsonb(COALESCE((click_daily.by_browser->>$6::text)::int, 0) + 1)),
            by_country = jsonb_set(click_daily.by_country, ARRAY[$7::text], to_jsonb(COALESCE((click_daily.by_country->>$7::text)::int, 0) + 1)),
            by_referrer = jsonb_set(click_daily.by_referrer, ARRAY[$8::text], to_jsonb(COALESCE((click_daily.by_referrer->>$8::text)::int, 0) + 1))`,
          [data.tenantId, data.linkId, dateStr, deviceKey, osKey, browserKey, countryKey, refKey, clicksDelta, uniqueDelta, botClicksDelta]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }
}
