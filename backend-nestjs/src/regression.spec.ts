import { describe, it, expect } from 'vitest';
import { LinkService } from './services/link.service.js';
import { ScreeningService } from './services/screening.service.js';
import { parseUserAgent } from './workers/click.processor.js';
import { UrlService } from './services/url.service.js';
import { isReservedPath } from './constants/reserved-paths.js';
import { RedisKeyBuilder, REDIS_KEYS } from './constants/redis-keys.js';
import { LinkStatus, ScreeningVerdict } from './constants/status.js';
import { ErrorCodes } from './constants/error-codes.js';

describe('JLMP Backend - Full Regression & PRD Verification Suite', () => {
  it('FR-04: Should generate valid Base58 short codes without ambiguous characters (0, O, 1, I, l)', () => {
    const forbiddenChars = ['0', 'O', '1', 'I', 'l'];
    for (let i = 0; i < 50; i++) {
      const code = LinkService.generateShortCode(6);
      expect(code.length).toBe(6);
      for (const char of forbiddenChars) {
        expect(code.includes(char)).toBe(false);
      }
    }
  });

  it('FR-08: Screening Service should detect and block shortener chaining (bit.ly, tinyurl, t.co)', () => {
    const validUrl = ScreeningService.validateDestinationUrl('https://jupsoft.com/admissions/apply');
    expect(validUrl.valid).toBe(true);

    const bitly = ScreeningService.validateDestinationUrl('https://bit.ly/3xMalware');
    expect(bitly.valid).toBe(false);
    expect(bitly.reason).toMatch(/Shortener chaining/);

    const tiny = ScreeningService.validateDestinationUrl('https://tinyurl.com/phish-site');
    expect(tiny.valid).toBe(false);

    const ftp = ScreeningService.validateDestinationUrl('ftp://files.example.com/payload.exe');
    expect(ftp.valid).toBe(false);
  });

  it('FR-11: User-Agent parser accurately extracts devices, OS, and identifies web crawlers / bots', () => {
    const iphone = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    );
    expect(iphone.device).toBe('mobile');
    expect(iphone.os).toBe('iOS');
    expect(iphone.browser).toBe('Safari');
    expect(iphone.isBot).toBe(false);

    const android = parseUserAgent(
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
    );
    expect(android.device).toBe('mobile');
    expect(android.os).toBe('Android');
    expect(android.browser).toBe('Chrome');
    expect(android.isBot).toBe(false);

    const edgeDesktop = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58'
    );
    expect(edgeDesktop.device).toBe('desktop');
    expect(edgeDesktop.os).toBe('Windows');
    expect(edgeDesktop.browser).toBe('Edge');
    expect(edgeDesktop.isBot).toBe(false);

    const bot = parseUserAgent('WhatsApp/2.23.13.76 A');
    expect(bot.isBot).toBe(true);
    expect(bot.device).toBe('bot');
  });

  it('FR-06: UrlService correctly appends UTM parameters and preserves existing query string', () => {
    const target = 'https://school.edu/admission?source=portal';
    const params = {
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'admissions_2026',
    };
    const finalUrl = UrlService.appendUtmParams(target, params);
    expect(finalUrl).toContain('source=portal');
    expect(finalUrl).toContain('utm_source=newsletter');
    expect(finalUrl).toContain('utm_medium=email');
    expect(finalUrl).toContain('utm_campaign=admissions_2026');
  });

  it('FR-06: Reserved paths are protected from being hijacked as short codes', () => {
    expect(isReservedPath('api')).toBe(true);
    expect(isReservedPath('health')).toBe(true);
    expect(isReservedPath('metrics')).toBe(true);
    expect(isReservedPath('system')).toBe(true);
    expect(isReservedPath('login')).toBe(true);
    expect(isReservedPath('admin')).toBe(true);

    expect(isReservedPath('admission2026')).toBe(false);
    expect(isReservedPath('fees-pay')).toBe(false);
  });

  it('FR-07: LinkService.toCachedLink correctly normalizes database records', () => {
    const dbRow = {
      id: '00000000-0000-0000-0000-000000000001',
      tenant_id: '11111111-1111-1111-1111-111111111111',
      domain_id: '22222222-2222-2222-2222-222222222222',
      short_code: 'abc123',
      alias: 'hw-admissions',
      destination_url: 'https://example.com/landing',
      redirect_type: '302',
      status: LinkStatus.ACTIVE,
      is_archived: false,
      click_count: 42,
      max_clicks: 100,
      expires_at: new Date('2027-01-01T00:00:00Z'),
    };

    const cached = LinkService.toCachedLink(dbRow);
    expect(cached.id).toBe(dbRow.id);
    expect(cached.tenantId).toBe(dbRow.tenant_id);
    expect(cached.domainId).toBe(dbRow.domain_id);
    expect(cached.destinationUrl).toBe('https://example.com/landing');
    expect(cached.currentClicks).toBe(42);
    expect(cached.maxClicks).toBe(100);
    expect(cached.redirectType).toBe(302);
  });

  it('Redis Key Builder formats consistent namespaced keys', () => {
    const linkKey = RedisKeyBuilder.link('dom-1', 'code99');
    expect(linkKey).toBe('link:dom-1:code99');

    const tenantKey = RedisKeyBuilder.tenantStatus('tenant-hw');
    expect(tenantKey).toBe('tenant:status:tenant-hw');

    const clicksKey = RedisKeyBuilder.linkClicks('dom-1', 'code99');
    expect(clicksKey).toBe('link_clicks:dom-1:code99');
  });

  it('Enterprise Error Codes conform to PRD specification', () => {
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCodes.ALIAS_CONFLICT).toBe('ALIAS_CONFLICT');
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ErrorCodes.SCREENING_FAILED).toBe('SCREENING_FAILED');
  });
});
