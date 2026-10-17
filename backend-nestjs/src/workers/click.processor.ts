import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
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
  DB_CONTEXT_KEYS,
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

const MAX_GEO_CACHE_SIZE = 10000;
const GEO_EVICT_BATCH = 500;
const geoCache = new Map<string, { code: string; label: string; expiresAt: number }>();

function putGeoCache(key: string, val: { code: string; label: string; expiresAt: number }) {
  if (geoCache.has(key)) {
    geoCache.delete(key);
  } else if (geoCache.size >= MAX_GEO_CACHE_SIZE) {
    // Evict oldest entries in FIFO/LRU order without clearing the entire cache (prevents cache stampede)
    const iter = geoCache.keys();
    for (let i = 0; i < GEO_EVICT_BATCH; i++) {
      const oldestKey = iter.next().value;
      if (oldestKey !== undefined) {
        geoCache.delete(oldestKey);
      } else {
        break;
      }
    }
  }
  geoCache.set(key, val);
}

// Circuit breaker for external Geo IP resolution to prevent cascading worker stalls
let geoCircuitFailures = 0;
let geoCircuitOpenUntil = 0;
const GEO_CIRCUIT_MAX_FAILURES = 5;
const GEO_CIRCUIT_COOLDOWN_MS = 30000;

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = (ip || '').replace(/^::ffff:/, '').trim();
  return (
    !clean ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(clean) ||
    clean.startsWith('169.254.')
  );
}

async function resolveGeoLocation(redis: RedisService, ip: string, cfCountry?: string): Promise<{ code: string; label: string }> {
  if (cfCountry && cfCountry !== 'XX' && cfCountry.length <= 8) {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const name = regionNames.of(cfCountry.toUpperCase());
      return { code: cfCountry.toUpperCase(), label: name ? `${name} (${cfCountry.toUpperCase()})` : cfCountry.toUpperCase() };
    } catch {
      return { code: cfCountry.toUpperCase(), label: cfCountry.toUpperCase() };
    }
  }

  if (isPrivateOrLocalIp(ip)) {
    return { code: 'LOCAL', label: 'Local Network' };
  }

  const cacheKey = ip;

  // L1 In-Memory Fast Cache lookup
  const now = Date.now();
  const memCached = geoCache.get(cacheKey);
  if (memCached && memCached.expiresAt > now) {
    return { code: memCached.code, label: memCached.label };
  }

  const redisGeoKey = `geo:ip:${cacheKey}`;
  try {
    const cached = await redis.client.get(redisGeoKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      putGeoCache(cacheKey, { ...parsed, expiresAt: now + 3600_000 });
      return parsed;
    }
  } catch {}

  // Check circuit breaker before external HTTP call
  if (now < geoCircuitOpenUntil) {
    return { code: 'XX', label: 'Unknown' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const target = encodeURIComponent(ip.replace(/^::ffff:/, ''));
    const res = await fetch(`http://ip-api.com/json/${target}?fields=status,country,countryCode,regionName,city`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        country?: string;
        countryCode?: string;
        regionName?: string;
        city?: string;
      };
      if (data?.status === 'success' && data.countryCode) {
        geoCircuitFailures = 0;
        const code = data.countryCode.slice(0, 8).toUpperCase();
        const place = data.city || data.regionName;
        const label = place && data.country ? `${place}, ${data.country} (${code})` : `${data.country || code} (${code})`;
        const result = { code, label };
        await redis.client.setex(redisGeoKey, 7 * 86400, JSON.stringify(result)).catch(() => {});
        putGeoCache(cacheKey, { ...result, expiresAt: now + 3600_000 });
        return result;
      }
    }
    geoCircuitFailures++;
    if (geoCircuitFailures >= GEO_CIRCUIT_MAX_FAILURES) {
      geoCircuitOpenUntil = Date.now() + GEO_CIRCUIT_COOLDOWN_MS;
    }
  } catch {
    geoCircuitFailures++;
    if (geoCircuitFailures >= GEO_CIRCUIT_MAX_FAILURES) {
      geoCircuitOpenUntil = Date.now() + GEO_CIRCUIT_COOLDOWN_MS;
    }
  }

  return { code: 'XX', label: 'Unknown' };
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
      const geo = await resolveGeoLocation(this.redis, data.ip, data.countryCode);

      const client = await this.db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('${DB_CONTEXT_KEYS.IS_SUPER_ADMIN}', 'true', true)`);

        const countryCode = geo.code;

        // Redis atomic unique-visitor check via HyperLogLog (12KB constant memory per link/day instead of MBs)
        let isUniqueToday = false;
        if (!uaInfo.isBot) {
          const visitKey = `visited:${data.linkId}:${dateStr}`;
          const isNewVisitor = await this.redis.client.pfadd(visitKey, visitorHash);
          if (isNewVisitor === 1) {
            await this.redis.client.expire(visitKey, 86400 * 2); // 48h TTL
            isUniqueToday = true;
          }
        }

        await client.query(
          `INSERT INTO clicks (link_id, tenant_id, clicked_at, visitor_hash, device, browser, os, country, referrer, is_bot) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [data.linkId, data.tenantId, clickedAt, visitorHash, uaInfo.device, uaInfo.browser, uaInfo.os, countryCode, data.referrer || null, uaInfo.isBot]
        );

        const deviceKey = uaInfo.device;
        const osKey = uaInfo.os;
        const browserKey = uaInfo.browser;
        const countryKey = geo.label;
        // Intelligent Referral / Source Attribution
        let refKey: string = FALLBACKS.REFERRER;
        const ua = data.userAgent || '';

        if (data.sourceQuery) {
          refKey = data.sourceQuery.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50);
        } else if (/whatsapp/i.test(ua)) {
          refKey = 'whatsapp';
        } else if (/instagram/i.test(ua)) {
          refKey = 'instagram';
        } else if (/fb_iab|fbav|facebook/i.test(ua)) {
          refKey = 'facebook';
        } else if (/telegram/i.test(ua)) {
          refKey = 'telegram';
        } else if (/linkedin/i.test(ua)) {
          refKey = 'linkedin';
        } else if (/twitter|tweet/i.test(ua)) {
          refKey = 'twitter';
        } else if (data.referrer) {
          try {
            const host = new URL(data.referrer).hostname.toLowerCase();
            if (host.includes('whatsapp')) refKey = 'whatsapp';
            else if (host.includes('instagram')) refKey = 'instagram';
            else if (host.includes('facebook') || host.includes('fb.me')) refKey = 'facebook';
            else if (host.includes('t.co') || host.includes('twitter.com') || host.includes('x.com')) refKey = 'twitter';
            else if (host.includes('linkedin.com') || host.includes('lnkd.in')) refKey = 'linkedin';
            else if (host.includes('youtube.com') || host.includes('youtu.be')) refKey = 'youtube';
            else if (host.includes('google.')) refKey = 'google';
            else if (host.includes('bing.')) refKey = 'bing';
            else if (host.includes('yahoo.')) refKey = 'yahoo';
            else if (host.includes('reddit.')) refKey = 'reddit';
            else {
              refKey = host.replace(/^www\./, '') || FALLBACKS.REFERRER;
            }
          } catch {
            refKey = FALLBACKS.REFERRER;
          }
        }

        if (uaInfo.isBot) {
          await client.query(
            `INSERT INTO click_daily (
              tenant_id, link_id, date, clicks, unique_clicks, bot_clicks,
              by_device, by_os, by_browser, by_country, by_referrer
            ) VALUES (
              $1, $2, $3, 0, 0, 1,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
            )
            ON CONFLICT (link_id, date) DO UPDATE SET
              bot_clicks = click_daily.bot_clicks + 1`,
            [data.tenantId, data.linkId, dateStr]
          );
        } else {
          const uniqueDelta = isUniqueToday ? 1 : 0;
          await client.query(
            `INSERT INTO click_daily (
              tenant_id, link_id, date, clicks, unique_clicks, bot_clicks,
              by_device, by_os, by_browser, by_country, by_referrer
            ) VALUES (
              $1, $2, $3, 1, $9, 0,
              jsonb_build_object($4::text, 1), jsonb_build_object($5::text, 1), jsonb_build_object($6::text, 1), jsonb_build_object($7::text, 1), jsonb_build_object($8::text, 1)
            )
            ON CONFLICT (link_id, date) DO UPDATE SET
              clicks = click_daily.clicks + 1, unique_clicks = click_daily.unique_clicks + $9,
              by_device = jsonb_set(click_daily.by_device, ARRAY[$4::text], to_jsonb(COALESCE((click_daily.by_device->>$4::text)::int, 0) + 1)),
              by_os = jsonb_set(click_daily.by_os, ARRAY[$5::text], to_jsonb(COALESCE((click_daily.by_os->>$5::text)::int, 0) + 1)),
              by_browser = jsonb_set(click_daily.by_browser, ARRAY[$6::text], to_jsonb(COALESCE((click_daily.by_browser->>$6::text)::int, 0) + 1)),
              by_country = jsonb_set(click_daily.by_country, ARRAY[$7::text], to_jsonb(COALESCE((click_daily.by_country->>$7::text)::int, 0) + 1)),
              by_referrer = jsonb_set(click_daily.by_referrer, ARRAY[$8::text], to_jsonb(COALESCE((click_daily.by_referrer->>$8::text)::int, 0) + 1))`,
            [data.tenantId, data.linkId, dateStr, deviceKey, osKey, browserKey, countryKey, refKey, uniqueDelta]
          );
        }

        // Atomic link click_count and status update at the end of transaction (minimizes row lock duration)
        if (!uaInfo.isBot) {
          await client.query(
            `UPDATE links 
             SET click_count = click_count + 1,
                 status = CASE 
                   WHEN max_clicks IS NOT NULL AND (click_count + 1) >= max_clicks THEN 'expired'
                   ELSE status
                 END
             WHERE id = $1`,
            [data.linkId]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ClickIngestJobData, any, string> | undefined, err: Error) {
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      try {
        await this.redis.client.lpush(
          'queue:clicks:dlq',
          JSON.stringify({
            jobId: job.id,
            data: job.data,
            error: err?.message || 'Unknown job failure',
            failedAt: new Date().toISOString(),
          })
        );
        await this.redis.client.ltrim('queue:clicks:dlq', 0, 9999);
      } catch {}
    }
  }
}
