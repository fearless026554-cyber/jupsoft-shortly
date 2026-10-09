import { env } from '../config/env.js';
import {
  DEFAULT_DISALLOWED_SHORTENERS,
  SAFE_BROWSING_CONFIG,
  ScreeningVerdict,
} from '../constants/index.js';

export class ScreeningService {
  /**
   * Validate destination URL against abuse and shortener chaining rules (FR-08)
   */
  public static validateDestinationUrl(urlStr: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(urlStr);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'Destination must use HTTP or HTTPS protocol' };
      }

      // Shortener chaining prevention using centralized configuration
      const hostname = parsed.hostname.toLowerCase();
      if (DEFAULT_DISALLOWED_SHORTENERS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Safe Browsing API failed with HTTP status ${res.status}`);
    }

    const data = (await res.json()) as { matches?: Array<{ threatType: string }> };
    if (data.matches && data.matches.length > 0) {
      return { clean: false, verdict: data.matches[0].threatType.toLowerCase() };
    }

    return { clean: true, verdict: ScreeningVerdict.CLEAN };
  }
}
