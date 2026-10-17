import * as crypto from 'node:crypto';
import { PoolClient } from 'pg';
import { env } from '../config/env.js';
import {
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
    domainId = env.DEFAULT_DOMAIN_ID,
    options?: {
      skipQr?: boolean;
      tenantCode?: string;
    }
  ): Promise<{ link: Link; shortUrl: string; aliasUrl?: string; qrSvg: string }> {
    // 1. Destination URL validation & anti-chaining screening (FR-08)
    const screening = ScreeningService.validateDestinationUrl(dto.destinationUrl);
    if (!screening.valid) {
      throw new Error(`Screening failed: ${screening.reason}`);
    }

    // 2. Validate tenant-scoped alias if supplied
    let sanitizedAlias: string | null = null;
    let shortCode = '';
    let inserted = false;
    let attempts = 0;
    let linkRecord: Link | null = null;

    if (dto.alias && dto.alias.trim()) {
      let rawAlias = dto.alias.trim();
      if (rawAlias.endsWith('-') || rawAlias.endsWith('*') || rawAlias.toLowerCase() === 'fee') {
        const prefix = rawAlias.replace(/[-*]+$/, '') || 'fee';
        rawAlias = `${prefix}-${this.generateShortCode(5).toLowerCase()}`;
      }
      sanitizedAlias = this.sanitizeAlias(rawAlias);

      // Check if alias / short code is already taken on this domain OR for this tenant
      let checkAlias = sanitizedAlias;
      const existing = await client.query(
        `SELECT id FROM links 
         WHERE (domain_id = $1 AND (short_code = $2 OR LOWER(alias) = LOWER($2)))
            OR (tenant_id = $3 AND (short_code = $2 OR LOWER(alias) = LOWER($2)))
         LIMIT 1`,
        [domainId, checkAlias, tenantId]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        // Auto-increment alias to prevent conflict (e.g., fee-3465 -> fee-3465-1 -> fee-3465-2)
        let counter = 1;
        let baseAlias = sanitizedAlias;
        const match = sanitizedAlias.match(/^(.*?)-(\d+)$/);
        if (match) {
          baseAlias = match[1];
          counter = parseInt(match[2], 10) + 1;
        }

        // Single query fetching all taken candidates matching baseAlias-% to avoid N sequential queries
        const escapedBaseAlias = baseAlias.replace(/[_%]/g, '\\$&');
        const pattern = `${escapedBaseAlias}-%`;
        const existingCandidatesRes = await client.query(
          `SELECT LOWER(COALESCE(alias, short_code)) as code FROM links 
           WHERE ((domain_id = $1) OR (tenant_id = $2))
             AND (LOWER(alias) LIKE $3 ESCAPE '\\' OR LOWER(short_code) LIKE $3 ESCAPE '\\')`,
          [domainId, tenantId, pattern.toLowerCase()]
        );

        const takenCodes = new Set<string>(existingCandidatesRes.rows.map((r: any) => r.code));
        let available = false;
        while (counter <= 1000) {
          const candidate = `${baseAlias}-${counter}`;
          if (!takenCodes.has(candidate.toLowerCase())) {
            sanitizedAlias = candidate;
            available = true;
            break;
          }
          counter++;
        }

        if (!available) {
          sanitizedAlias = `${baseAlias}-${Date.now().toString(36).slice(-4)}`;
        }
      }

      shortCode = sanitizedAlias;
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
        if (err.code === '23505') {
          // Fallback auto-suffix on rare concurrency race condition
          const fallbackAlias = `${sanitizedAlias}-${Date.now().toString(36).slice(-3)}`;
          const fallbackRes = await client.query(
            `INSERT INTO links (
              tenant_id, domain_id, short_code, alias, destination_url,
              redirect_type, status, expires_at, max_clicks, tag, external_ref
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
              tenantId,
              domainId,
              fallbackAlias,
              fallbackAlias,
              dto.destinationUrl,
              dto.redirectType || String(FALLBACKS.REDIRECT_TYPE),
              LinkStatus.ACTIVE,
              dto.expiresAt ? new Date(dto.expiresAt) : null,
              dto.maxClicks || null,
              dto.tag || null,
              dto.externalRef || null,
            ]
          );
          linkRecord = fallbackRes.rows[0];
          inserted = true;
        } else {
          throw err;
        }
      }
    } else {
      // 3. Collision-resistant code generation with enterprise retry limits
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
              null,
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
          throw err;
        }
      }
    }

    if (!inserted || !linkRecord) {
      throw new Error('Unable to allocate unique short code. Please try again.');
    }

    // 4. Generate Short URL & Dynamic QR code (FR-10)
    const shortUrl = UrlService.buildShortUrl(shortCode);
    let qrSvg = '';
    if (!options?.skipQr) {
      qrSvg = await QrService.generateSvg(shortUrl);
    }

    // 5. Persist QR Code & Screening Audit Trail in a single CTE query to eliminate network roundtrips
    await client.query(
      `WITH ins_qr AS (
         INSERT INTO qr_codes (link_id, is_dynamic, qr_svg_data)
         VALUES ($1, true, $2)
         RETURNING id
       )
       INSERT INTO screening_results (link_id, provider, verdict, checked_at)
       VALUES ($1, $3, $4, NOW())`,
      [
        linkRecord.id,
        qrSvg || null,
        ScreeningProvider.HEURISTICS_SAFE_BROWSING,
        ScreeningVerdict.PENDING,
      ]
    );

    // 6. Query tenant code for human-readable alias URL (FR-05)
    let aliasUrl: string | undefined;
    if (sanitizedAlias) {
      let tCode = options?.tenantCode;
      if (!tCode) {
        const tRes = await client.query('SELECT code FROM tenants WHERE id = $1', [tenantId]);
        tCode = tRes.rows[0]?.code;
      }
      if (tCode) {
        aliasUrl = UrlService.buildAliasUrl(tCode, sanitizedAlias);
      } else {
        aliasUrl = UrlService.buildShortUrl(sanitizedAlias);
      }
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
