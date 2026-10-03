import * as crypto from 'node:crypto';
import { PoolClient } from 'pg';
import { env } from '../config/env.js';
import {
  BULK_CONSTANTS,
  FALLBACKS,
  LINK_CONSTANTS,
  LinkStatus,
  ScreeningProvider,
  ScreeningVerdict,
  isReservedPath,
} from '../constants/index.js';
import { CreateLinkDto, Link, CachedLink } from '../types/index.js';
import { ScreeningService } from './screening.service.js';
import { QrService } from './qr.service.js';
import { UrlService } from './url.service.js';

export class LinkService {
  /**
   * Generates a cryptographically secure Base58 short code
   */
  public static generateShortCode(length: number = FALLBACKS.SHORT_CODE_DEFAULT_LENGTH): string {
    const bytes = crypto.randomBytes(length);
    let code = '';
    const alphabet = LINK_CONSTANTS.SHORT_CODE_ALPHABET;
    for (let i = 0; i < length; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    return code;
  }

  /**
   * Strict alias sanitization & validation against enterprise reserved keywords
   */
  public static sanitizeAlias(rawAlias: string): string {
    let alias = rawAlias.trim().toLowerCase();
    try {
      alias = decodeURIComponent(alias);
    } catch {
      // ignore decode failure
    }
    alias = alias.replace(/^\/+|\/+$/g, '');

    if (isReservedPath(alias)) {
      throw new Error(`Alias '${alias}' is a reserved system keyword`);
    }

    if (!LINK_CONSTANTS.ALIAS_REGEX.test(alias)) {
      throw new Error(
        `Alias must be ${LINK_CONSTANTS.ALIAS_MIN_LEN}-${LINK_CONSTANTS.ALIAS_MAX_LEN} characters alphanumeric, hyphen or underscore`
      );
    }

    return alias;
  }

  /**
   * Create a new short link with RLS enforcement, QR code, and screening audit trail
   */
  public static async createLink(
    client: PoolClient,
    tenantId: string,
    dto: CreateLinkDto,
    domainId = env.DEFAULT_DOMAIN_ID
  ): Promise<{ link: Link; shortUrl: string; aliasUrl?: string; qrSvg: string }> {
    // 1. Destination URL validation & anti-chaining screening (FR-08)
    const screening = ScreeningService.validateDestinationUrl(dto.destinationUrl);
    if (!screening.valid) {
      throw new Error(`Screening failed: ${screening.reason}`);
    }

    // 2. Validate tenant-scoped alias if supplied
    let sanitizedAlias: string | null = null;
    if (dto.alias) {
      sanitizedAlias = this.sanitizeAlias(dto.alias);

      const existingAlias = await client.query(
        'SELECT id FROM links WHERE tenant_id = $1 AND alias = $2',
        [tenantId, sanitizedAlias]
      );
      if (existingAlias.rowCount && existingAlias.rowCount > 0) {
        throw new Error(`Alias '${sanitizedAlias}' is already taken for your organization`);
      }
    }

    // 3. Collision-resistant code generation with enterprise retry limits
    let shortCode = '';
    let inserted = false;
    let attempts = 0;
    let linkRecord: Link | null = null;

    while (!inserted && attempts < FALLBACKS.SHORT_CODE_MAX_RETRIES) {
      attempts++;
      const codeLen: number =
        attempts > 2 ? FALLBACKS.SHORT_CODE_MAX_COLLISION_LENGTH : FALLBACKS.SHORT_CODE_DEFAULT_LENGTH;
      shortCode = this.generateShortCode(codeLen);

      try {
        const res = await client.query(
          `INSERT INTO links (
            tenant_id, domain_id, short_code, alias, destination_url,
            redirect_type, status, expires_at, max_clicks, tag, external_ref
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            tenantId,
            domainId,
            shortCode,
            sanitizedAlias,
            dto.destinationUrl,
            dto.redirectType || String(FALLBACKS.REDIRECT_TYPE),
            LinkStatus.ACTIVE,
            dto.expiresAt ? new Date(dto.expiresAt) : null,
            dto.maxClicks || null,
            dto.tag || null,
            dto.externalRef || null,
          ]
        );

        linkRecord = res.rows[0];
        inserted = true;
      } catch (err: any) {
        if (err.code === '23505' && err.constraint === 'uq_domain_short_code') {
          continue;
        }
        if (err.code === '23505' && err.constraint === 'uq_tenant_alias') {
          const conflictErr: any = new Error(`Alias '${sanitizedAlias}' is already taken for your organization`);
          conflictErr.statusCode = 409;
          conflictErr.code = 'ALIAS_CONFLICT';
          throw conflictErr;
        }
        throw err;
      }
    }

    if (!inserted || !linkRecord) {
      throw new Error('Unable to allocate unique short code. Please try again.');
    }

    // 4. Generate Short URL & Dynamic QR code (FR-10)
    const shortUrl = UrlService.buildShortUrl(shortCode);
    const qrSvg = await QrService.generateSvg(shortUrl);

    await client.query(
      `INSERT INTO qr_codes (link_id, is_dynamic, qr_svg_data)
       VALUES ($1, true, $2)`,
      [linkRecord.id, qrSvg]
    );

    // 5. Persist Screening Audit Trail (PRD Page 11 screening_results table)
    await client.query(
      `INSERT INTO screening_results (link_id, provider, verdict, checked_at)
       VALUES ($1, $2, $3, NOW())`,
      [linkRecord.id, ScreeningProvider.HEURISTICS_SAFE_BROWSING, ScreeningVerdict.PENDING]
    );

    // 6. Query tenant code for human-readable alias URL (FR-05)
    let aliasUrl: string | undefined;
    if (sanitizedAlias) {
      const tenantRes = await client.query('SELECT code FROM tenants WHERE id = $1', [tenantId]);
      const tenantCode = tenantRes.rows[0]?.code || BULK_CONSTANTS.FALLBACK_TENANT_CODE;
      aliasUrl = UrlService.buildAliasUrl(tenantCode, sanitizedAlias);
    }

    return {
      link: linkRecord,
      shortUrl,
      aliasUrl,
      qrSvg,
    };
  }

  public static toCachedLink(row: any): CachedLink {
    const rawDest = row.destination_url ?? row.destinationUrl;
    if (!rawDest) {
      throw new Error('Invalid link record: missing destination_url in database row');
    }

    return {
      id: row.id,
      tenantId: row.tenant_id ?? row.tenantId,
      domainId: row.domain_id ?? row.domainId ?? '',
      destinationUrl: rawDest,
      redirectType: Number(row.redirect_type ?? row.redirectType ?? FALLBACKS.REDIRECT_TYPE) as 302 | 307,
      status: row.status,
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
      maxClicks: row.max_clicks ? Number(row.max_clicks) : null,
      currentClicks: Number(row.click_count ?? row.currentClicks ?? 0),
    };
  }
}
