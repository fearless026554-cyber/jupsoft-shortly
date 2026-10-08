// ============================================================================
// Canonical Redis Key Factory & Builders
// ============================================================================

export const RedisKeyBuilder = {
  link: (domainId: string, shortCode: string) => `link:${domainId}:${shortCode}`,
  linkClicks: (domainId: string, shortCode: string) => `link_clicks:${domainId}:${shortCode}`,
  alias: (tenantId: string, alias: string) => `alias:${tenantId}:${alias}`,
  domain: (hostname: string) => `domain:${hostname}`,
  tenantStatus: (tenantId: string) => `tenant:status:${tenantId}`,
  visitorSalt: (dateStr: string) => `visitor_salt:${dateStr}`,
  authKey: (keyHash: string) => `auth:key:${keyHash}`,
  rateLimitKey: (keyId: string, windowTimestamp: number) => `rate:apikey:${keyId}:${windowTimestamp}`,
  apiKeyMeta: (keyId: string) => `rate:meta:${keyId}`,
  apiKeyTotal: (keyId: string) => `rate:total:${keyId}`,
  apiKeyLimit: (keyId: string) => `rate:limit:${keyId}`,
  apiKeyHashToId: (keyHash: string) => `hash:to:id:${keyHash}`,
  idempotency: (tenantId: string, key: string) => `idempotency:${tenantId}:${key}`,
  domainBlacklist: () => 'blacklist:shortener_domains',
} as const;

export const REDIS_KEYS = {
  LINK: RedisKeyBuilder.link,
  LINK_CLICKS: RedisKeyBuilder.linkClicks,
  ALIAS: RedisKeyBuilder.alias,
  DOMAIN: RedisKeyBuilder.domain,
  TENANT_STATUS: RedisKeyBuilder.tenantStatus,
  VISITOR_SALT: RedisKeyBuilder.visitorSalt,
  AUTH_KEY: RedisKeyBuilder.authKey,
  RATE_LIMIT_KEY: RedisKeyBuilder.rateLimitKey,
  API_KEY_META: RedisKeyBuilder.apiKeyMeta,
  API_KEY_TOTAL: RedisKeyBuilder.apiKeyTotal,
  API_KEY_LIMIT: RedisKeyBuilder.apiKeyLimit,
  API_KEY_HASH_TO_ID: RedisKeyBuilder.apiKeyHashToId,
  IDEMPOTENCY: RedisKeyBuilder.idempotency,
  DOMAIN_BLACKLIST: RedisKeyBuilder.domainBlacklist,
} as const;
