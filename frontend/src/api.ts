// JLMP Enterprise API Client connecting to NestJS Backend on Port 3000

export const API_BASE_URL = '/api/proxy';

export interface LinkItem {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  short_code: string;
  alias?: string | null;
  destination_url: string;
  redirect_type: string;
  status: 'active' | 'disabled' | 'expired' | 'blocked' | 'archived';
  click_count: number;
  max_clicks?: number | null;
  expires_at?: string | null;
  tag?: string | null;
  external_ref?: string | null;
  is_permanent?: boolean;
  isPermanent?: boolean;
  created_at: string;
}

export interface CreateLinkDto {
  destinationUrl: string;
  alias?: string;
  expiresAt?: string;
  maxClicks?: number;
  tag?: string;
  externalRef?: string;
  redirectType?: '302' | '307';
  isPermanent?: boolean;
  is_permanent?: boolean;
  tenantId?: string;
}

export interface OutcomeRecord {
  id: string;
  external_ref: string;
  outcome_type: string;
  value: number;
  occurred_at: string;
}

export interface TenantItem {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'suspended' | 'archived';
  plan_id: string;
  created_at: string;
}

export interface UserItem {
  id: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_code?: string;
  name: string;
  email: string;
  role: 'super_admin' | 'tenant_admin' | 'manager' | 'user' | 'read_only';
  status: 'active' | 'invited' | 'suspended';
  avatar_url?: string | null;
  last_login_at?: string | null;
  created_at: string;
}

export interface DomainItem {
  id: string;
  hostname: string;
  type: 'internal' | 'public' | 'custom';
  verification_status: 'pending' | 'verified' | 'failed';
  dlt_status: 'pending' | 'submitted' | 'whitelisted' | 'rejected';
  ssl_active: boolean;
  created_at: string;
  txt_token?: string;
  server_ip?: string;
  live_dns?: {
    aRecords: string[];
    cnameRecords: string[];
    txtRecords: string[];
  };
}

export interface AbuseReportItem {
  id: string;
  link_id: string;
  reporter_email?: string | null;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'reviewed' | 'dismissed';
  created_at: string;
}

const TOKEN_STORAGE_KEY = 'jlmp_auth_token';
const USER_STORAGE_KEY = 'jlmp_auth_user';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) return token;
  try {
    const match = document.cookie.match(new RegExp('(^|; )' + TOKEN_STORAGE_KEY + '=([^;]+)'));
    if (match && match[2]) {
      const cookieToken = decodeURIComponent(match[2]);
      if (cookieToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, cookieToken);
        return cookieToken;
      }
    }
  } catch {}
  return null;
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  clearApiCache();
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    document.cookie = `${TOKEN_STORAGE_KEY}=${token}; path=/; max-age=604800; SameSite=Lax`;
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.cookie = `${TOKEN_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

function handleAuthExpired() {
  if (typeof window === 'undefined') return;
  const search = window.location.search || '';
  if (search.includes('code=') || search.includes('token=') || search.includes('credential=')) {
    return;
  }
  setAuthToken(null);
  setStoredUser(null);
  clearApiCache();
  const pathname = window.location.pathname;
  if (pathname !== '/login' && pathname !== '/' && pathname !== '/landing') {
    window.location.href = '/login?expired=1';
  }
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(USER_STORAGE_KEY);
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed && (parsed.id || parsed.userId || parsed.email)) {
        return parsed;
      }
    } catch {}
  }

  // Fallback: decode session JWT payload if stored user is absent
  const token = getAuthToken();
  if (token && token.includes('.')) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        if (payload && (payload.userId || payload.email)) {
          const fallbackUser = {
            id: payload.userId,
            email: payload.email,
            name: payload.name || (payload.email ? payload.email.split('@')[0] : 'User'),
            role: payload.role || 'user',
            tenant_id: payload.tenantId,
            status: 'active',
          };
          setStoredUser(fallbackUser);
          return fallbackUser;
        }
      }
    } catch {}
  }
  return null;
}

export function setStoredUser(user: any | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

const headers = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return getHeaders()[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(getHeaders());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getHeaders(), prop);
  },
});

// In-flight deduplication map & response caching (Solves P0 API over-fetch audit & cross-user leak)
const inFlightRequests = new Map<string, Promise<any>>();
const responseCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 15000;

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    inFlightRequests.clear();
    responseCache.clear();
    return;
  }
  for (const key of Array.from(responseCache.keys())) {
    if (key.includes(prefix)) {
      responseCache.delete(key);
    }
  }
  for (const key of Array.from(inFlightRequests.keys())) {
    if (key.includes(prefix)) {
      inFlightRequests.delete(key);
    }
  }
}

export async function secureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options: RequestInit = { ...init };
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization') && !headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  options.headers = headers;

  const res = await fetch(input, options);
  if (res.status === 401) {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (!urlStr.includes('/auth/login') && !urlStr.includes('/auth/google')) {
      handleAuthExpired();
    }
  }
  return res;
}

async function dedupeGet<T>(url: string, fetchFn: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const token = getAuthToken() || 'anon';
  const scopedKey = `${token}:${url}`;
  const cached = responseCache.get(scopedKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < ttl) {
    return cached.data as T;
  }

  if (inFlightRequests.has(scopedKey)) {
    return inFlightRequests.get(scopedKey) as Promise<T>;
  }

  const promise = fetchFn()
    .then((data) => {
      responseCache.set(scopedKey, { timestamp: Date.now(), data });
      inFlightRequests.delete(scopedKey);
      return data;
    })
    .catch((err) => {
      inFlightRequests.delete(scopedKey);
      throw err;
    });

  inFlightRequests.set(scopedKey, promise);
  return promise;
}

export const api = {
  // Health
  async getHealth() {
    return dedupeGet('health', async () => {
      const res = await secureFetch(`${API_BASE_URL}/health`);
      return res.json();
    }, 15000);
  },

  // Links
  async getLinks(tenantId?: string, limit = 5000): Promise<LinkItem[]> {
    const cacheKey = `${API_BASE_URL}/links?tenantId=${tenantId || 'all'}&limit=${limit}`;
    return dedupeGet(cacheKey, async () => {
      try {
        let allItems: LinkItem[] = [];
        let cursor: string | null = null;
        const batchSize = Math.min(limit, 1000);

        do {
          const params = new URLSearchParams();
          params.set('limit', String(batchSize));
          if (tenantId) params.set('tenantId', tenantId);
          if (cursor) params.set('cursor', cursor);

          const res = await secureFetch(`${API_BASE_URL}/links?${params.toString()}`, { headers });
          const json = await res.json();
          if (!json.success || !json.data) break;

          const items: LinkItem[] = Array.isArray(json.data) ? json.data : (json.data.items || []);
          allItems = allItems.concat(items);

          cursor = json.data?.nextCursor || null;
          if (!cursor || items.length === 0 || allItems.length >= limit) {
            break;
          }
        } while (cursor && allItems.length < limit);

        return allItems;
      } catch {
        return [];
      }
    }, 15000);
  },

  async createLink(dto: CreateLinkDto) {
    clearApiCache('links');
    const res = await secureFetch(`${API_BASE_URL}/links`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async archiveLink(id: string) {
    clearApiCache('links');
    const res = await secureFetch(`${API_BASE_URL}/links/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  async deleteLinkPermanently(id: string) {
    clearApiCache('links');
    const res = await secureFetch(`${API_BASE_URL}/links/${id}?permanent=true`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  async updateLink(id: string, dto: { destinationUrl?: string; alias?: string | null; status?: string; expiresAt?: string | null; maxClicks?: number | null; tag?: string; isPermanent?: boolean; is_permanent?: boolean }) {
    clearApiCache('links');
    const res = await secureFetch(`${API_BASE_URL}/links/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  // High-performance atomic batch actions (Archive / Restore / Delete)
  async batchAction(action: 'archive' | 'restore' | 'delete', ids: string[]) {
    clearApiCache('links');
    const res = await secureFetch(`${API_BASE_URL}/links/batch-action`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids }),
    });
    return res.json();
  },

  async batchArchive(ids: string[]) {
    return this.batchAction('archive', ids);
  },

  async batchRestore(ids: string[]) {
    return this.batchAction('restore', ids);
  },

  async batchDeletePermanently(ids: string[]) {
    return this.batchAction('delete', ids);
  },

  // Bulk
  async bulkCreate(items: Array<{ destinationUrl: string; alias?: string; tag?: string; externalRef?: string }>, tenantId?: string) {
    clearApiCache('links');
    const payload: any = { links: items };
    if (tenantId && tenantId !== 'all') payload.tenantId = tenantId;
    const res = await secureFetch(`${API_BASE_URL}/links/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getBulkStatus(jobId: string) {
    try {
      const res = await secureFetch(`${API_BASE_URL}/links/bulk/${jobId}`, { headers });
      return res.json();
    } catch {
      return null;
    }
  },

  async cancelBulkJob(jobId: string) {
    try {
      const res = await secureFetch(`${API_BASE_URL}/links/bulk/${jobId}/cancel`, {
        method: 'POST',
        headers,
      });
      return res.json();
    } catch {
      return { success: false, error: { message: 'Network error while attempting cancellation' } };
    }
  },

  async cloneLink(id: string) {
    clearApiCache('links');
    const res = await secureFetch(`${API_BASE_URL}/links/${id}/clone`, {
      method: 'POST',
      headers,
    });
    return res.json();
  },

  // Analytics
  async getAnalyticsSummary(startDate?: string, endDate?: string, tenantId?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (tenantId && tenantId !== 'all') params.set('tenantId', tenantId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = `${API_BASE_URL}/analytics/summary${queryString}`;
    return dedupeGet(url, async () => {
      try {
        const res = await secureFetch(url, { headers });
        const json = await res.json();
        return json.success ? json.data : null;
      } catch {
        return null;
      }
    }, 60000);
  },

  async getLinkAnalytics(id: string) {
    return dedupeGet(`${API_BASE_URL}/analytics/links/${id}`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/analytics/links/${id}`, { headers });
        const json = await res.json();
        return json.success ? json.data : null;
      } catch {
        return null;
      }
    }, 60000);
  },

  // Outcomes
  async getOutcomesReport(tenantId?: string) {
    const params = new URLSearchParams();
    if (tenantId && tenantId !== 'all') params.set('tenantId', tenantId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = `${API_BASE_URL}/outcomes/report${queryString}`;
    return dedupeGet(url, async () => {
      try {
        const res = await secureFetch(url, { headers });
        const json = await res.json();
        return json.success ? json.data : null;
      } catch {
        return null;
      }
    });
  },

  async getOutcomes(limit = 50, tenantId?: string) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (tenantId && tenantId !== 'all') params.set('tenantId', tenantId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return dedupeGet(`${API_BASE_URL}/outcomes${queryString}`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/outcomes${queryString}`, { headers });
        const json = await res.json();
        return json.success ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async recordOutcome(data: { externalRef: string; outcomeType: string; value: number; tenantId?: string }) {
    clearApiCache('outcomes');
    const res = await secureFetch(`${API_BASE_URL}/outcomes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Tenants
  async getTenants(): Promise<TenantItem[]> {
    return dedupeGet(`${API_BASE_URL}/tenants`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/tenants`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createTenant(dto: { code: string; name: string; planId: string }) {
    clearApiCache('tenants');
    const res = await secureFetch(`${API_BASE_URL}/tenants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async updateTenantStatus(id: string, status: 'active' | 'suspended' | 'archived') {
    clearApiCache('tenants');
    const res = await secureFetch(`${API_BASE_URL}/tenants/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Users & RBAC
  async getUsers(tenantId?: string): Promise<UserItem[]> {
    const params = new URLSearchParams();
    if (tenantId && tenantId !== 'all') params.set('tenantId', tenantId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return dedupeGet(`${API_BASE_URL}/users${queryString}`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/users${queryString}`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async inviteUser(dto: { name: string; email: string; role: string; password?: string; tenantId?: string }) {
    clearApiCache('users');
    const res = await secureFetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async resetUserPassword(id: string, password: string) {
    clearApiCache('users');
    const res = await secureFetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });
    return res.json();
  },

  async updateUser(id: string, payload: { role?: string; status?: string; password?: string }) {
    clearApiCache('users');
    const res = await secureFetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async deleteUser(id: string) {
    clearApiCache('users');
    const res = await secureFetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Domains & TRAI DLT
  async getDomains(tenantId?: string): Promise<DomainItem[]> {
    const params = new URLSearchParams();
    if (tenantId && tenantId !== 'all') params.set('tenantId', tenantId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return dedupeGet(`${API_BASE_URL}/domains${queryString}`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/domains${queryString}`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createDomain(dto: { hostname: string; type?: string; tenantId?: string }) {
    clearApiCache('domains');
    const res = await secureFetch(`${API_BASE_URL}/domains`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async verifyDomain(id: string) {
    clearApiCache('domains');
    const res = await secureFetch(`${API_BASE_URL}/domains/${id}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return res.json();
  },

  async deleteDomain(id: string) {
    clearApiCache('domains');
    const res = await secureFetch(`${API_BASE_URL}/domains/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  // Abuse Reports
  async getAbuseCount(): Promise<number> {
    return dedupeGet(`${API_BASE_URL}/abuse-reports/count`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/abuse-reports/count`, { headers });
        const json = await res.json();
        return json.success && typeof json.count === 'number' ? json.count : 0;
      } catch {
        return 0;
      }
    }, 30000);
  },

  async getAbuseReports(status?: string, limit = 50): Promise<AbuseReportItem[]> {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    query.set('limit', String(limit));
    const url = `${API_BASE_URL}/abuse-reports?${query.toString()}`;
    return dedupeGet(url, async () => {
      try {
        const res = await secureFetch(url, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async updateAbuseReport(id: string, payload: { status: string; disableLink?: boolean; suspendTenant?: boolean } | string) {
    clearApiCache('abuse-reports');
    const body = typeof payload === 'string' ? { status: payload } : payload;
    const res = await secureFetch(`${API_BASE_URL}/abuse-reports/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    return res.json();
  },

  // API Keys
  async getApiKeys() {
    return dedupeGet(`${API_BASE_URL}/api-keys`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/api-keys`, { headers });
        const json = await res.json();
        return json.success ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createApiKey(name: string, scopes: string[], rateLimitRpm = 10) {
    clearApiCache('api-keys');
    const res = await secureFetch(`${API_BASE_URL}/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, scopes, rateLimitRpm }),
    });
    return res.json();
  },

  async updateApiKeyRateLimit(id: string, rateLimitRpm: number) {
    clearApiCache('api-keys');
    const res = await secureFetch(`${API_BASE_URL}/api-keys/${id}/rate-limit`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ rateLimitRpm }),
    });
    return res.json();
  },

  async revokeApiKey(id: string) {
    clearApiCache('api-keys');
    const res = await secureFetch(`${API_BASE_URL}/api-keys/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  // Auth Operations
  async login(email: string, password: string) {
    clearApiCache();
    const res = await secureFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (json.success && json.data?.token) {
      setAuthToken(json.data.token);
      setStoredUser(json.data.user);
    }
    return json;
  },

  async googleLogin(payload: { credential?: string; idToken?: string; code?: string; redirectUri?: string; nonce?: string; state?: string }) {
    clearApiCache();
    const res = await secureFetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success && json.data?.token) {
      setAuthToken(json.data.token);
      setStoredUser(json.data.user);
    }
    return json;
  },

  async getGoogleAuthConfig() {
    return dedupeGet(`${API_BASE_URL}/auth/google/config`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/auth/google/config`);
        const json = await res.json();
        return json.success ? json.data : { enabled: false, clientId: null };
      } catch {
        return { enabled: false, clientId: null };
      }
    }, 60000);
  },

  async logout() {
    clearApiCache();
    try {
      await secureFetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {}
    setAuthToken(null);
    setStoredUser(null);
  },

  async getMe() {
    const token = getAuthToken();
    if (!token) return null;
    return dedupeGet(`${API_BASE_URL}/auth/me`, async () => {
      try {
        const res = await secureFetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
        const json = await res.json().catch(() => null);
        if (json && json.success && json.data?.user) {
          setStoredUser(json.data.user);
        }
        if (json) {
          return { ...json, _status: res.status };
        }
        return { success: false, _status: res.status, error: { code: 'HTTP_' + res.status, message: 'Request failed' } };
      } catch {
        return null;
      }
    }, 15000);
  },

  async updateProfile(payload: { name?: string; avatar_url?: string | null }) {
    clearApiCache();
    const res = await secureFetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const existingUser = getStoredUser();
      if (existingUser) {
        setStoredUser({ ...existingUser, ...json.data });
      }
    }
    return json;
  },

  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    const res = await secureFetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async forgotPassword(email: string) {
    const res = await secureFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  async resetPasswordWithToken(payload: { token: string; newPassword: string }) {
    const res = await secureFetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};

// Utility to export table data to CSV file
export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
