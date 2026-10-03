import { env } from '../config/env.js';
import { API_PREFIX } from '../constants/auth.js';

export class UrlService {
  /**
   * Normalize base URL by removing any trailing slashes
   */
  private static getBaseUrl(): string {
    return env.BASE_URL.replace(/\/+$/, '');
  }

  public static buildShortUrl(shortCode: string): string {
    return `${this.getBaseUrl()}/${shortCode.replace(/^\/+/, '')}`;
  }

  public static buildAliasUrl(tenantCode: string, alias: string): string {
    const cleanTenant = tenantCode.replace(/^\/+|\/+$/g, '');
    const cleanAlias = alias.replace(/^\/+|\/+$/g, '');
    return `${this.getBaseUrl()}/${cleanTenant}/${cleanAlias}`;
  }

  public static buildApiUrl(subPath: string): string {
    const cleanPath = subPath.replace(/^\/+/, '');
    return `${this.getBaseUrl()}${API_PREFIX}/${cleanPath}`;
  }

  public static buildQrUrl(linkId: string, format: 'png' | 'svg' = 'png'): string {
    return `${this.getBaseUrl()}${API_PREFIX}/links/${linkId}/qr?format=${format}`;
  }

  public static buildBulkStatusUrl(jobId: string): string {
    return `${this.getBaseUrl()}${API_PREFIX}/links/bulk/${jobId}`;
  }

  public static appendUtmParams(
    destinationUrl: string,
    params: {
      utmSource?: string | null;
      utmMedium?: string | null;
      utmCampaign?: string | null;
      utmTerm?: string | null;
      utmContent?: string | null;
    }
  ): string {
    const url = new URL(destinationUrl);
    if (params.utmSource) url.searchParams.set('utm_source', params.utmSource);
    if (params.utmMedium) url.searchParams.set('utm_medium', params.utmMedium);
    if (params.utmCampaign) url.searchParams.set('utm_campaign', params.utmCampaign);
    if (params.utmTerm) url.searchParams.set('utm_term', params.utmTerm);
    if (params.utmContent) url.searchParams.set('utm_content', params.utmContent);
    return url.toString();
  }
}
