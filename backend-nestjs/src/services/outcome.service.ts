import { PoolClient } from 'pg';
import { OutcomeEventDto } from '../types/index.js';

export interface OutcomeAttributionResult {
  outcomeId: string;
  matchedLinkId: string | null;
  status: 'attributed' | 'unmatched';
  outcomeType: string;
  value: number;
}

export class OutcomeService {
  /**
   * Record a business outcome event and match against links.external_ref or linkId (FR-16)
   * Append-only ledger with optional eventId idempotency (Fix 28)
   */
  public static async recordOutcome(
    client: PoolClient,
    tenantId: string,
    dto: OutcomeEventDto
  ): Promise<OutcomeAttributionResult> {
    let matchedLinkId: string | null = null;
    let externalRef = dto.externalRef || 'direct';

    // 1. If explicit linkId provided, find link directly
    if (dto.linkId) {
      const linkRes = await client.query(
        `SELECT id, external_ref FROM links WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, dto.linkId]
      );
      if (linkRes.rowCount && linkRes.rowCount > 0) {
        matchedLinkId = linkRes.rows[0].id;
        if (!dto.externalRef && linkRes.rows[0].external_ref) {
          externalRef = linkRes.rows[0].external_ref;
        }
      }
    } else if (dto.externalRef) {
      // Time-window matching: prefer link created before or at occurredAt
      const occurredDate = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
      const timeMatchRes = await client.query(
        `SELECT id FROM links 
         WHERE tenant_id = $1 AND external_ref = $2 AND created_at <= $3
         ORDER BY created_at DESC 
         LIMIT 1`,
        [tenantId, dto.externalRef, occurredDate]
      );

      if (timeMatchRes.rowCount && timeMatchRes.rowCount > 0) {
        matchedLinkId = timeMatchRes.rows[0].id;
      } else {
        // Fallback to most recent link matching external_ref
        const fallbackRes = await client.query(
          `SELECT id FROM links 
           WHERE tenant_id = $1 AND external_ref = $2
           ORDER BY created_at DESC 
           LIMIT 1`,
          [tenantId, dto.externalRef]
        );
        matchedLinkId = fallbackRes.rows[0]?.id || null;
      }
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const value = dto.value || 0;
    const metadataJson = JSON.stringify(dto.metadata || {});

    // 2. Insert outcome: append-only ledger or idempotent on event_id if provided (Fix 28)
    let outcomeId: string;
    if (dto.eventId) {
      const insertRes = await client.query(
        `INSERT INTO outcomes (
          tenant_id, link_id, external_ref, outcome_type, value, metadata, event_id, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (tenant_id, event_id) 
        DO UPDATE SET
          value = EXCLUDED.value,
          metadata = EXCLUDED.metadata,
          occurred_at = EXCLUDED.occurred_at,
          link_id = COALESCE(EXCLUDED.link_id, outcomes.link_id)
        RETURNING id`,
        [
          tenantId,
          matchedLinkId,
          externalRef,
          dto.outcomeType,
          value,
          metadataJson,
          dto.eventId,
          occurredAt,
        ]
      );
      outcomeId = insertRes.rows[0].id;
    } else {
      const insertRes = await client.query(
        `INSERT INTO outcomes (
          tenant_id, link_id, external_ref, outcome_type, value, metadata, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          tenantId,
          matchedLinkId,
          externalRef,
          dto.outcomeType,
          value,
          metadataJson,
          occurredAt,
        ]
      );
      outcomeId = insertRes.rows[0].id;
    }

    return {
      outcomeId,
      matchedLinkId,
      status: matchedLinkId ? 'attributed' : 'unmatched',
      outcomeType: dto.outcomeType,
      value: Number(value),
    };
  }

  /**
   * Get link attribution summary: clicks vs outcomes including unmatched count (Fix 29)
   */
  public static async getAttributionReport(
    client: PoolClient,
    tenantId: string,
    linkId?: string
  ): Promise<any> {
    if (linkId) {
      const res = await client.query(
        `SELECT 
          l.id AS link_id,
          l.short_code,
          l.external_ref,
          l.click_count,
          COUNT(o.id) AS outcome_count,
          COALESCE(SUM(o.value), 0) AS total_revenue_attributed,
          (SELECT COUNT(*) FROM outcomes WHERE tenant_id = $1 AND link_id IS NULL) AS unmatched_outcomes
         FROM links l
         LEFT JOIN outcomes o ON l.id = o.link_id
         WHERE l.tenant_id = $1 AND l.id = $2
         GROUP BY l.id, l.short_code, l.external_ref, l.click_count`,
        [tenantId, linkId]
      );
      return res.rows[0] || null;
    }

    // Tenant aggregate attribution without JOIN fan-out (Fix 22 & Fix 29)
    const res = await client.query(
      `SELECT 
        (SELECT COUNT(*) FROM links WHERE tenant_id = $1) AS total_links,
        (SELECT COALESCE(SUM(click_count), 0) FROM links WHERE tenant_id = $1) AS total_clicks,
        (SELECT COUNT(*) FROM outcomes WHERE tenant_id = $1) AS total_outcomes,
        (SELECT COUNT(*) FROM outcomes WHERE tenant_id = $1 AND link_id IS NOT NULL) AS matched_outcomes,
        (SELECT COUNT(*) FROM outcomes WHERE tenant_id = $1 AND link_id IS NULL) AS unmatched_outcomes,
        (SELECT COALESCE(SUM(value), 0) FROM outcomes WHERE tenant_id = $1 AND link_id IS NOT NULL) AS total_revenue_attributed,
        (SELECT COALESCE(SUM(value), 0) FROM outcomes WHERE tenant_id = $1) AS total_outcome_revenue`,
      [tenantId]
    );

    return res.rows[0];
  }
}
