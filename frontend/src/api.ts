// JLMP Enterprise API Client connecting to NestJS Backend on Port 3000

export const API_BASE_URL = '/api/proxy';
export const DEFAULT_PAGE_LIMIT = process.env.NEXT_PUBLIC_DEFAULT_PAGE_LIMIT ? Number(process.env.NEXT_PUBLIC_DEFAULT_PAGE_LIMIT) : 100;

export interface LinkItem {
  id: string;
  short_code: string;
  alias?: string | null;
  destination_url: string;
  redirect_type: string;
  status: 'active' | 'disabled' | 'expired' | 'blocked';
  click_count: number;
  max_clicks?: number | null;
  expires_at?: string | null;
  tag?: string | null;
  external_ref?: string | null;
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
  name: string;
  email: string;
  role: 'super_admin' | 'tenant_admin' | 'manager' | 'user' | 'read_only';
  status: 'active' | 'invited' | 'suspended';
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
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

export const TOKEN_STORAGE_KEY = 'jlmp_auth_token';
export const USER_STORAGE_KEY = 'jlmp_auth_user';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    document.cookie = `${TOKEN_STORAGE_KEY}=${token}; path=/; max-age=604800; SameSite=Lax`;
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.cookie = `${TOKEN_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(USER_STORAGE_KEY);
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
}

export function setStoredUser(user: any | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function getHeaders(): Record<string, string> {
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

// In-flight deduplication map & response caching (Solves P0 API over-fetch audit)
const inFlightRequests = new Map<string, Promise<any>>();
const responseCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 2500;

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of Array.from(responseCache.keys())) {
    if (key.includes(prefix)) {
      responseCache.delete(key);
    }
  }
}

async function dedupeGet<T>(url: string, fetchFn: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const cached = responseCache.get(url);
  const now = Date.now();
  if (cached && now - cached.timestamp < ttl) {
    return cached.data as T;
  }

  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const promise = fetchFn()
    .then((data) => {
      responseCache.set(url, { timestamp: Date.now(), data });
      inFlightRequests.delete(url);
      return data;
    })
    .catch((err) => {
      inFlightRequests.delete(url);
      throw err;
    });

  inFlightRequests.set(url, promise);
  return promise;
}

export const api = {
  // Health
  async getHealth() {
    return dedupeGet('health', async () => {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.json();
    }, 5000);
  },

  // Links
  async getLinks(tenantId?: string, limit = DEFAULT_PAGE_LIMIT): Promise<LinkItem[]> {
    const url = `${API_BASE_URL}/links?limit=${limit}${tenantId ? `&tenantId=${tenantId}` : ''}`;
    return dedupeGet(url, async () => {
      try {
        const res = await fetch(url, { headers });
        const json = await res.json();
        if (json.success && json.data) {
          return Array.isArray(json.data) ? json.data : (json.data.items || []);
        }
        return [];
      } catch {
        return [];
      }
    });
  },

  async createLink(dto: CreateLinkDto) {
    clearApiCache('links');
    const res = await fetch(`${API_BASE_URL}/links`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async archiveLink(id: string) {
    clearApiCache('links');
    const res = await fetch(`${API_BASE_URL}/links/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  async updateLink(id: string, dto: { destinationUrl?: string; status?: string; expiresAt?: string | null; maxClicks?: number | null; tag?: string }) {
    clearApiCache('links');
    const res = await fetch(`${API_BASE_URL}/links/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  // Bulk
  async bulkCreate(items: Array<{ destinationUrl: string; alias?: string; tag?: string; externalRef?: string }>) {
    clearApiCache('links');
    const res = await fetch(`${API_BASE_URL}/links/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ links: items }),
    });
    return res.json();
  },

  async getBulkStatus(jobId: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/links/bulk/${jobId}`, { headers });
      return res.json();
    } catch {
      return null;
    }
  },

  async cloneLink(id: string) {
    clearApiCache('links');
    const res = await fetch(`${API_BASE_URL}/links/${id}/clone`, {
      method: 'POST',
      headers,
    });
    return res.json();
  },

  // Analytics
  async getAnalyticsSummary() {
    return dedupeGet(`${API_BASE_URL}/analytics/summary`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/analytics/summary`, { headers });
        const json = await res.json();
        return json.success ? json.data : null;
      } catch {
        return null;
      }
    });
  },

  async getLinkAnalytics(id: string) {
    return dedupeGet(`${API_BASE_URL}/analytics/links/${id}`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/analytics/links/${id}`, { headers });
        const json = await res.json();
        return json.success ? json.data : null;
      } catch {
        return null;
      }
    });
  },

  // Outcomes
  async getOutcomesReport() {
    return dedupeGet(`${API_BASE_URL}/outcomes/report`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/outcomes/report`, { headers });
        const json = await res.json();
        return json.success ? json.data : null;
      } catch {
        return null;
      }
    });
  },

  async getOutcomes(limit = 50) {
    return dedupeGet(`${API_BASE_URL}/outcomes?limit=${limit}`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/outcomes?limit=${limit}`, { headers });
        const json = await res.json();
        return json.success ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async recordOutcome(data: { externalRef: string; outcomeType: string; value: number }) {
    clearApiCache('outcomes');
    const res = await fetch(`${API_BASE_URL}/outcomes`, {
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
        const res = await fetch(`${API_BASE_URL}/tenants`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createTenant(dto: { code: string; name: string; planId: string }) {
    clearApiCache('tenants');
    const res = await fetch(`${API_BASE_URL}/tenants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async updateTenantStatus(id: string, status: 'active' | 'suspended' | 'archived') {
    clearApiCache('tenants');
    const res = await fetch(`${API_BASE_URL}/tenants/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Users & RBAC
  async getUsers(): Promise<UserItem[]> {
    return dedupeGet(`${API_BASE_URL}/users`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async inviteUser(dto: { name: string; email: string; role: string; password?: string }) {
    clearApiCache('users');
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async resetUserPassword(id: string, password: string) {
    clearApiCache('users');
    const res = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ password }),
    });
    return res.json();
  },

  // Domains & TRAI DLT
  async getDomains(): Promise<DomainItem[]> {
    return dedupeGet(`${API_BASE_URL}/domains`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/domains`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createDomain(dto: { hostname: string; type?: string }) {
    clearApiCache('domains');
    const res = await fetch(`${API_BASE_URL}/domains`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    return res.json();
  },

  async verifyDomain(id: string) {
    clearApiCache('domains');
    const res = await fetch(`${API_BASE_URL}/domains/${id}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    return res.json();
  },

  async deleteDomain(id: string) {
    clearApiCache('domains');
    const res = await fetch(`${API_BASE_URL}/domains/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  // Abuse Reports
  async getAbuseReports(): Promise<AbuseReportItem[]> {
    return dedupeGet(`${API_BASE_URL}/abuse-reports`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/abuse-reports`, { headers });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async updateAbuseReport(id: string, status: string) {
    clearApiCache('abuse-reports');
    const res = await fetch(`${API_BASE_URL}/abuse-reports/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // API Keys
  async getApiKeys() {
    return dedupeGet(`${API_BASE_URL}/api-keys`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api-keys`, { headers });
        const json = await res.json();
        return json.success ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createApiKey(name: string, scopes: string[]) {
    clearApiCache('api-keys');
    const res = await fetch(`${API_BASE_URL}/api-keys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, scopes }),
    });
    return res.json();
  },

  async revokeApiKey(id: string) {
    clearApiCache('api-keys');
    const res = await fetch(`${API_BASE_URL}/api-keys/${id}`, {
      method: 'DELETE',
      headers,
    });
    return res.json();
  },

  // Auth Operations
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
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

  async logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {}
    setAuthToken(null);
    setStoredUser(null);
    clearApiCache();
  },

  async getMe() {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getHeaders() });
      const json = await res.json();
      if (json.success && json.data?.user) {
        setStoredUser(json.data.user);
      }
      return json;
    } catch {
      return null;
    }
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
