import { env } from '../config/env.js';
import {
  DEFAULT_DISALLOWED_SHORTENERS,
  SAFE_BROWSING_CONFIG,
  ScreeningVerdict,
} from '../constants/index.js';

export class ScreeningService {
  /**
   * Validate destination URL against abuse, shortener chaining, and SSRF/internal network addresses (FR-08, SEC-02)
   */
  public static validateDestinationUrl(urlStr: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(urlStr);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'Destination must use HTTP or HTTPS protocol' };
      }

      const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

      // SSRF & Private/Internal IP protection (RFC-1918, RFC-3927 link-local, loopback, AWS metadata)
      const isPrivateOrInternal = (host: string): boolean => {
        if (
          host === 'localhost' ||
          host.endsWith('.localhost') ||
          host.endsWith('.local') ||
          host.endsWith('.internal') ||
          host === '0.0.0.0' ||
          host === '127.0.0.1' ||
          host === '::1' ||
          host === '::'
        ) {
          return true;
        }

        // IPv4 ranges
        if (/^127\./.test(host)) return true; // Loopback 127.0.0.0/8
        if (/^10\./.test(host)) return true;  // Private RFC-1918 10.0.0.0/8
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true; // Private RFC-1918 172.16.0.0/12
        if (/^192\.168\./.test(host)) return true; // Private RFC-1918 192.168.0.0/16
        if (/^169\.254\./.test(host)) return true; // Link-local / Cloud metadata (169.254.169.254)

        // IPv6 private/link-local
        if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;

        return false;
      };

      if (isPrivateOrInternal(hostname)) {
        return { valid: false, reason: 'Destination URL cannot point to local, private, or cloud metadata network addresses' };
      }

      // Shortener chaining prevention using centralized configuration
      const bareHostname = parsed.hostname.toLowerCase();
      if (DEFAULT_DISALLOWED_SHORTENERS.some((d) => bareHostname === d || bareHostname.endsWith(`.${d}`))) {
        return { valid: false, reason: 'Shortener chaining is strictly disallowed (linking to another URL shortener)' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid destination URL format' };
    }
  }

  /**
   * Google Safe Browsing API check using env.SAFE_BROWSING_ENDPOINT and SAFE_BROWSING_CONFIG
   */
  public static async screenUrlWithSafeBrowsing(urlStr: string): Promise<{ clean: boolean; verdict: string }> {
    if (!env.SAFE_BROWSING_API_KEY) {
      throw new Error('SAFE_BROWSING_API_KEY is not configured. Cannot perform malware screening.');
    }

    const endpoint = `${env.SAFE_BROWSING_ENDPOINT}?key=${env.SAFE_BROWSING_API_KEY}`;
    const body = {
      client: {
        clientId: SAFE_BROWSING_CONFIG.CLIENT_ID,
        clientVersion: SAFE_BROWSING_CONFIG.CLIENT_VERSION,
      },
      threatInfo: {
        threatTypes: [...SAFE_BROWSING_CONFIG.THREAT_TYPES],
        platformTypes: [...SAFE_BROWSING_CONFIG.PLATFORM_TYPES],
        threatEntryTypes: [...SAFE_BROWSING_CONFIG.THREAT_ENTRY_TYPES],
        threatEntries: [{ url: urlStr }],
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Safe Browsing API failed with HTTP status ${res.status}`);
      }

      const data = (await res.json()) as { matches?: Array<{ threatType: string }> };
      if (data.matches && data.matches.length > 0) {
        return { clean: false, verdict: data.matches[0].threatType.toLowerCase() };
      }

      return { clean: true, verdict: ScreeningVerdict.CLEAN };
    } finally {
      clearTimeout(timer);
    }
  }
}
