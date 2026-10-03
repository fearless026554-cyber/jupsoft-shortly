import { PoolClient } from 'pg';

export interface AuditLogEntry {
  tenantId?: string | null;
  actorId?: string | null;
  actorType: 'api_key' | 'user' | 'system';
  action: string;
  entity: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export class AuditService {
  /**
   * Record mutation event in audit_log table
   */
  public static async log(client: PoolClient, entry: AuditLogEntry): Promise<void> {
    try {
      await client.query(
        `INSERT INTO audit_log (
          tenant_id, actor_id, actor_type, action, entity, entity_id, before_state, after_state, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.tenantId || null,
          entry.actorId || null,
          entry.actorType,
          entry.action,
          entry.entity,
          entry.entityId,
          entry.beforeState ? JSON.stringify(entry.beforeState) : null,
          entry.afterState ? JSON.stringify(entry.afterState) : null,
          entry.ipAddress || null,
        ]
      );
    } catch (err) {
      // Audit failure should not block the primary operation, but trigger alert
      console.error('[AUDIT_ALERT] Failed to persist audit log entry:', err, entry);
    }
  }
}
