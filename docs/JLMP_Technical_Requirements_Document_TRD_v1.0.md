# Jupsoft Link Management Platform (JLMP)
## Technical Requirements Document (TRD) · Version 1.0 (MVP)

---

### Document Control & Metadata
- **Document Title:** Jupsoft Link Management Platform (JLMP) — Technical Requirements Document (TRD)
- **Document Version:** 1.0
- **Base PRD Reference:** Jupsoft Link Management Platform (JLMP) — PRD v1.0 (Dated Sep 28, 2026, by Sachin Sharma)
- **Target Audience:** Engineering Leads, Backend Engineers, Frontend Engineers, DevOps/Infrastructure Engineers, QA Engineers, Security & Compliance Teams
- **Target Stack:** TypeScript (Node.js 22 LTS), Fastify, NestJS, PostgreSQL 16 (RLS + Partitioning), Redis 7 (BullMQ), React 19 / Vite, Cloudflare, AWS ECS Fargate (ap-south-1 Mumbai)
- **Status:** Approved for Implementation

---

## 1. Executive Technical Summary & Architectural Principles

### 1.1 Purpose & Engineering Scope
The **Jupsoft Link Management Platform (JLMP)** is an enterprise-grade, multi-tenant link shortening, dynamic QR generation, click analytics, and outcome-attribution engine. Unlike commercial generic URL shorteners (e.g., Bitly, Rebrandly), JLMP's core engineering mandate is to serve as the unified, highly trusted communication and attribution infrastructure for Jupsoft's enterprise products (**eConnect ERP, Admission CRM, CRM, LMS, and DigifyNext campaigns**).

JLMP solves four mission-critical technical problems:
1. **SMS Length & Cost Optimization:** Shrinking URLs to ensure SMS notifications stay strictly within the single 160-character segment limit.
2. **TRAI DLT Whitelisting & SMS Deliverability:** Operating on dedicated, pre-whitelisted branded domains under Indian telecommunication regulations.
3. **Ecosystem Outcome Attribution (The Core Moat - FR-16):** Correlating an SMS/email link click directly to downstream enterprise actions (e.g., fee invoice cleared in ERP, admission application submitted, lead status changed).
4. **Independent, Self-Contained Multi-Tenant Foundation:** Native multi-tenancy with PostgreSQL Row-Level Security (RLS) from Day 1 to allow frictionless commercial rollout without refactoring.

### 1.2 Core Architectural Tenets
1. **Zero-Blocking Redirect Path:** The redirect hot-path must **never** wait for database writes, geo-lookup, or analytics calculation. Click events are pushed asynchronously to a distributed Redis queue; the redirect response (HTTP 302) is served strictly from memory (Redis) within $\le 50\text{ ms}$ (p95).
2. **Strict Multi-Tenant Isolation:** Defense-in-depth isolation utilizing application-level context injection coupled with PostgreSQL Row-Level Security (RLS) at the database layer.
3. **Privacy by Design (DPDP Act 2023 Compliance):** Zero raw IP address storage. Anonymized visitor fingerprinting via daily-rotated cryptographic salts. Data localized strictly to AWS Mumbai (`ap-south-1`).
4. **Two-Domain Isolation Boundary:** Strict physical separation between the internal ecosystem short domain (e.g., `jup.link`) and the public/commercial tenant short domain (e.g., `jups.in`) to ensure zero domain reputation contamination.
5. **No 301 Permanent Redirects:** Only HTTP 302 (Found) or HTTP 307 (Temporary Redirect) are permitted to ensure browser cache never bypasses click tracking and link lifecycle controls.

---

## 2. High-Level Architecture & Component Decomposition

### 2.1 System Context & Component Architecture
The system is bifurcated into two decoupled application services sharing a common storage foundation, orchestrated behind Cloudflare:

```
                                  [ Cloudflare Edge Network ]
                                 (DNS, TLS 1.3, WAF, DDoS, Geo)
                                                |
                       +------------------------+------------------------+
                       |                                                 |
         [ Internal/Public Short Domains ]                     [ Admin / API Domain ]
            (e.g., jup.link, jups.in)                          (e.g., app.jlmp.jupsoft.com)
                       |                                                 |
                       v                                                 v
           +-----------------------+                         +-----------------------+
           |   Redirect Service    |                         |    Admin & Core API   |
           |    (Fastify / TS)     |                         |     (NestJS / TS)     |
           +-----------+-----------+                         +-----------+-----------+
                       |                                                 |
          +------------+------------+                       +------------+------------+
          |                         |                       |                         |
          v                         v                       v                         v
    +-----------+             +-----------+           +-----------+             +-----------+
    |   Redis   |             |  BullMQ   |           | PostgreSQL|             | Object    |
    | (L1 Cache)|             | (Queues)  |           | (RDS RLS) |             | Storage   |
    +-----------+             +-----+-----+           +-----+-----+             | (S3 - QR) |
                                    |                       ^                   +-----------+
                                    v                       |
                              +-----------+                 |
                              |   Click   |                 |
                              |  Worker   +-----------------+
                              | (NestJS)  |  (Batch Writes)
                              +-----------+
```

### 2.2 Component Roles & Boundaries

| Component | Technology | Primary Responsibility | SLA / Latency Target |
| :--- | :--- | :--- | :--- |
| **Edge Gateway** | Cloudflare Enterprise / Pro | TLS termination, DDoS mitigation, Bot Fight Mode, Rate limiting, Geo-IP enrichment headers (`CF-IPCountry`). | Edge latency < 20ms |
| **Redirect Service** | Fastify (Node.js 22 LTS) | Ultra-lightweight HTTP 302/307 redirect engine. Cache-first lookup via Redis. On-demand DB fallback on cache-miss. Non-blocking click dispatch to BullMQ. | p95 < 50ms (hit), < 150ms (miss) |
| **Admin & Core API** | NestJS (Node.js 22 LTS) | Multi-tenant REST API, API key authentication, RBAC, CRUD for links/campaigns, QR generator, Malicious URL screening dispatch, Outcome ingestion endpoint. | p95 < 500ms |
| **Click Worker** | NestJS Microservice / BullMQ | Consumes click jobs from Redis. Resolves UA to OS/Browser/Device. Computes DPDP-compliant visitor hash. Performs batch inserts into monthly partitioned `clicks` table and rollups into `click_daily`. | Asynchronous (sub-5s lag) |
| **Web Console** | React 19 + Vite + Tailwind | Multi-tenant single-page dashboard. Link management, QR export, click analytics charts, API key management, and Super Admin tenant governance. | Client load < 1.5s |
| **Primary Database** | AWS Aurora PostgreSQL 16 | Relational persistence. Row-Level Security enabled for all tenant tables. Monthly table partitioning for `clicks`. | High availability Multi-AZ |
| **Cache & Message Broker** | AWS ElastiCache Redis 7 | L1 Link metadata cache, API key rate-limiting counters, and BullMQ click ingest queue. | In-memory < 2ms |
| **Object Storage** | AWS S3 (Mumbai `ap-south-1`) | Static asset storage for high-resolution dynamic and static QR code files (SVG/PNG). | Private bucket with CloudFront CDN |

---

## 3. Data Architecture & Database Schema Specification

### 3.1 Multi-Tenancy & Row-Level Security (RLS) Strategy
Multi-tenancy is enforced using the **Shared Database, Shared Schema with Row-Level Security** model. Every tenant-scoped table contains `tenant_id UUID NOT NULL REFERENCES tenants(id)`.

To prevent SQL injection or human error in application-layer `WHERE tenant_id = ...` clauses, PostgreSQL RLS is enabled on all tenant tables. Before executing queries within a tenant context, the connection executes:
```sql
SET LOCAL app.current_tenant_id = '018f3a2b-7c1e-7b2a-8d3f-1234567890ab';
```
PostgreSQL automatically filters all rows where `tenant_id = current_setting('app.current_tenant_id')::uuid`. Super Admin operations bypass this by executing with the platform admin database role or setting a bypass session variable.

### 3.2 Complete PostgreSQL DDL Specification

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS & USERS
-- ============================================================================
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'user', 'read_only');
CREATE TYPE user_status AS ENUM ('active', 'invited', 'suspended');

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE, -- Used for short-code prefixes, e.g. "hw", "dps"
    name VARCHAR(255) NOT NULL,
    status tenant_status NOT NULL DEFAULT 'active',
    plan_id VARCHAR(64) DEFAULT 'internal_unlimited',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tenants_status ON tenants(status);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform super_admin
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);

-- ============================================================================
-- 2. DOMAINS & ROUTING
-- ============================================================================
CREATE TYPE domain_type AS ENUM ('internal', 'public', 'subdomain', 'custom');
CREATE TYPE domain_verification_status AS ENUM ('pending', 'verified', 'failed');
CREATE TYPE dlt_whitelisting_status AS ENUM ('pending', 'submitted', 'whitelisted', 'rejected');

CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system-wide internal/public domains
    hostname VARCHAR(255) NOT NULL UNIQUE,
    type domain_type NOT NULL DEFAULT 'custom',
    verification_status domain_verification_status NOT NULL DEFAULT 'pending',
    dlt_status dlt_whitelisting_status NOT NULL DEFAULT 'pending',
    dlt_registration_details JSONB DEFAULT '{}'::jsonb,
    ssl_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_domains_hostname ON domains(hostname);
CREATE INDEX idx_domains_tenant ON domains(tenant_id);

-- ============================================================================
-- 3. LINKS & LIFECYCLE
-- ============================================================================
CREATE TYPE redirect_type AS ENUM ('302', '307');
CREATE TYPE link_status AS ENUM ('active', 'disabled', 'expired', 'archived', 'blocked');

CREATE TABLE links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES domains(id),
    short_code VARCHAR(16) NOT NULL,
    alias VARCHAR(128),
    destination_url TEXT NOT NULL,
    redirect_type redirect_type NOT NULL DEFAULT '302',
    status link_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    max_clicks BIGINT,
    click_count BIGINT NOT NULL DEFAULT 0,
    tag VARCHAR(64),
    external_ref VARCHAR(128), -- e.g. Fee invoice ID, ERP Lead ID (FR-16)
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_domain_short_code UNIQUE(domain_id, short_code),
    CONSTRAINT uq_tenant_alias UNIQUE(tenant_id, alias)
);
CREATE INDEX idx_links_lookup ON links(domain_id, short_code);
CREATE INDEX idx_links_tenant_alias ON links(tenant_id, alias);
CREATE INDEX idx_links_external_ref ON links(tenant_id, external_ref);
CREATE INDEX idx_links_tag ON links(tenant_id, tag);

-- ============================================================================
-- 4. QR CODES
-- ============================================================================
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL UNIQUE REFERENCES links(id) ON DELETE CASCADE,
    is_dynamic BOOLEAN NOT NULL DEFAULT TRUE,
    foreground_color VARCHAR(16) NOT NULL DEFAULT '#000000',
    background_color VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
    logo_s3_key TEXT,
    qr_svg_s3_key TEXT,
    qr_png_s3_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. CLICKS (PARTITIONED BY MONTH FOR HIGH THROUGHPUT)
-- ============================================================================
CREATE TABLE clicks (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    clicked_at TIMESTAMPTZ NOT NULL,
    visitor_hash VARCHAR(64) NOT NULL, -- Daily salted hash (DPDP Act compliant)
    device VARCHAR(32),                -- desktop, mobile, tablet, bot
    browser VARCHAR(64),               -- Chrome, Safari, Edge, Firefox
    os VARCHAR(64),                    -- Android, iOS, Windows, macOS, Linux
    country VARCHAR(8),                -- ISO 3166-1 alpha-2 from Cloudflare
    referrer TEXT,                     -- Documented Referrer Header
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id, clicked_at)
) PARTITION BY RANGE (clicked_at);

-- Example Monthly Partitions
CREATE TABLE clicks_2026_10 PARTITION OF clicks
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
CREATE TABLE clicks_2026_11 PARTITION OF clicks
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE INDEX idx_clicks_link_time ON clicks (link_id, clicked_at DESC);
CREATE INDEX idx_clicks_tenant_time ON clicks (tenant_id, clicked_at DESC);

-- ============================================================================
-- 6. CLICK DAILY AGGREGATES (DASHBOARD FAST READS)
-- ============================================================================
CREATE TABLE click_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clicks BIGINT NOT NULL DEFAULT 0,
    unique_clicks BIGINT NOT NULL DEFAULT 0,
    by_device JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_os JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_browser JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_country JSONB NOT NULL DEFAULT '{}'::jsonb,
    by_referrer JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_link_date UNIQUE(link_id, date)
);
CREATE INDEX idx_click_daily_tenant_date ON click_daily(tenant_id, date DESC);

-- ============================================================================
-- 7. OUTCOMES ATTRIBUTION (FR-16 ECOSYSTEM MOAT)
-- ============================================================================
CREATE TABLE outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    link_id UUID REFERENCES links(id) ON DELETE SET NULL,
    external_ref VARCHAR(128) NOT NULL, -- Matched to links.external_ref
    outcome_type VARCHAR(64) NOT NULL,  -- 'fee_paid', 'enquiry_raised', 'admission_confirmed'
    value NUMERIC(12, 2) DEFAULT 0.00,  -- e.g. Payment amount in INR
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_outcomes_link_id ON outcomes(link_id);
CREATE INDEX idx_outcomes_tenant_ref ON outcomes(tenant_id, external_ref);

-- ============================================================================
-- 8. SECURITY, AUDIT & ABUSE
-- ============================================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,    -- e.g. "jlp_live_"
    key_hash VARCHAR(255) NOT NULL,     -- Argon2id or SHA-256 hash of secret key
    scopes TEXT[] NOT NULL DEFAULT '{"links:read", "links:write", "analytics:read"}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_keys_lookup ON api_keys(key_prefix, revoked_at);

CREATE TABLE screening_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL,      -- 'google_safe_browsing', 'virustotal'
    verdict VARCHAR(32) NOT NULL,       -- 'clean', 'phishing', 'malware', 'suspicious'
    raw_response JSONB,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_screening_link ON screening_results(link_id);

CREATE TABLE abuse_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    reporter_email VARCHAR(255),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'dismissed'
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_abuse_status ON abuse_reports(status);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id UUID,                     -- User ID or API Key ID
    actor_type VARCHAR(32) NOT NULL,   -- 'user', 'api_key', 'system'
    action VARCHAR(64) NOT NULL,       -- 'link.create', 'link.disable', 'domain.verify'
    entity VARCHAR(64) NOT NULL,       -- 'links', 'tenants', 'api_keys'
    entity_id VARCHAR(64) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);
```

### 3.3 PostgreSQL Row-Level Security (RLS) Policies
PostgreSQL RLS is enabled across all tenant-isolated tables.

```sql
-- Enable RLS
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Tenant Policy Definition
CREATE POLICY tenant_isolation_links ON links
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY tenant_isolation_click_daily ON click_daily
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );

CREATE POLICY tenant_isolation_outcomes ON outcomes
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_super_admin', true) = 'true'
    );
```

---

## 4. Redis Cache Design & BullMQ Queue Schemas

### 4.1 Redis Caching Architecture
To guarantee p95 redirect latency under $50\text{ ms}$, the Redirect Service bypasses PostgreSQL on all cache hits.

#### Key Formats & Data Structures

| Key Pattern | Redis Type | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `link:{domain_id}:{code}` | String (JSON) | 24 Hours | Link routing record (Destination URL, Status, Redirect Type, Expiry, Max Clicks). |
| `alias:{tenant_id}:{alias}` | String (UUID) | 24 Hours | Maps human-readable tenant alias to `link_id`. |
| `domain:{hostname}` | String (JSON) | 7 Days | Domain metadata (ID, Tenant ID, Type, SSL status). |
| `rate:apikey:{key_hash}` | String (Integer) | 60 Seconds | Rolling window rate limiter counter for Admin REST API. |
| `visitor_salt:{YYYY-MM-DD}` | String (Hex) | 48 Hours | Ephemeral cryptographically random salt for daily visitor hashing. |

#### Link Cache Payload Format (`link:{domain_id}:{code}`)
```json
{
  "id": "018f3a2b-7c1e-7b2a-8d3f-1234567890ab",
  "tenant_id": "018f3a2a-4b1c-7b2a-8d3f-abcdef123456",
  "destination_url": "https://school.jupsoft.com/fees/pay?inv=INV-98214",
  "redirect_type": 302,
  "status": "active",
  "expires_at": 1790800000000,
  "max_clicks": 500,
  "current_clicks": 42
}
```

#### Cache Invalidation & Event Propagation
When a link's destination URL, expiry, or status is modified in the Admin API:
1. PostgreSQL transaction commits.
2. The Admin API executes a Redis multi-command pipeline:
   - `DEL link:{domain_id}:{code}`
   - `DEL alias:{tenant_id}:{alias}`
3. Emits an asynchronous cache warming job to BullMQ or directly primes the cache with the updated record.

---

### 4.2 BullMQ Queue Architecture & Asynchronous Click Pipeline

```
[ Incoming Click ] 
       |
       v
[ Fastify Redirect Engine ]
   - Resolves Destination
   - Answers 302 Immediately
   - Non-blocking BullMQ Queue Push
       |
       v
[ Redis Queue: click-ingestion-queue ]
       |
       +---> [ Click Worker 1 ]
       +---> [ Click Worker 2 ]
                |
                +-- UA Parsing (Device, OS, Browser, Bot)
                +-- Daily Hash Generation (HMAC-SHA256 with Salt)
                +-- Micro-batching Buffer (100 events or 1 second)
                |
                v
        [ PostgreSQL Aurora ]
           1. INSERT INTO clicks_YYYY_MM
           2. UPSERT INTO click_daily (Increment counters)
           3. Atomic Increment in links (click_count = click_count + 1)
```

#### BullMQ Click Job Data Contract
```typescript
export interface ClickIngestJobData {
  linkId: string;
  tenantId: string;
  domainId: string;
  clickedAt: string; // ISO 8601
  ip: string;        // Used strictly in-memory by worker to generate hash; NEVER written to DB
  userAgent: string;
  referrer?: string;
  countryCode?: string; // Extracted directly from CF-IPCountry header
}
```

#### BullMQ Queue Definitions

| Queue Name | Concurrency | Backoff Strategy | Max Retries | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `click-ingestion-queue` | 10 workers | Exponential (1000ms base) | 3 | Real-time click ingestion & processing. |
| `bulk-link-creation-queue` | 2 workers | Fixed (5000ms) | 2 | Processes CSV / API batches of up to 10,000 links. |
| `url-screening-queue` | 4 workers | Exponential (2000ms base) | 5 | Safe-browsing screening API calls. |

---

## 5. Core Technical Algorithms & Pipelines

### 5.1 Short Code Generation & Collision Handling (FR-04)
To ensure maximum readability and eliminate visual ambiguity on SMS and printed circulars, JLMP avoids look-alike characters (`0`, `O`, `1`, `I`, `l`).

#### Modified Base58 Alphabet Specification
$$\Sigma = \text{"23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"}$$
$|\Sigma| = 58$ symbols.

- For length $L = 6$: $58^6 \approx 38.06 \text{ billion unique combinations}$.
- For length $L = 7$: $58^7 \approx 2.2 \text{ trillion unique combinations}$.

#### Generation Algorithm & Collision Loop
```typescript
import crypto from 'node:crypto';

const ALPHABET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

export function generateShortCode(length: number = CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
```

#### Database Insertion & Retry Semantics
1. Attempt insertion with the generated code.
2. If PostgreSQL raises unique constraint violation `uq_domain_short_code` (Error code `23505`):
   - Retry generation up to 3 times.
   - If collision persists on the 3rd attempt, increment code length to $7$ characters.
   - All collisions log a warning metric (`shortcode_collision_count`).

---

### 5.2 Tenant-Scoped Alias Routing Pipeline (FR-05)
To prevent cross-tenant alias collisions without requiring dedicated root domains in MVP, aliases are strictly tenant-prefixed:
- Format: `https://<domain>/<tenant_code>/<alias>` (e.g., `https://jup.link/hw/admission-2027`)
- Reserved Words Dictionary (Blocked as tenant codes or root routes):
  `api`, `admin`, `console`, `login`, `logout`, `health`, `metrics`, `static`, `assets`, `qr`, `report`, `webhook`, `billing`.

#### Alias Resolution Logic
1. Request arrives at `/hw/admission-2027`.
2. Path is parsed into `tenant_code = "hw"` and `alias = "admission-2027"`.
3. Fastify fetches `tenant_id` by `code = "hw"`.
4. Fastify looks up `alias:{tenant_id}:{alias}` in Redis.
5. If found, retrieves link payload and executes 302 redirect.

---

### 5.3 Privacy-Preserving Visitor Fingerprinting (DPDP Act 2023)
To ensure strict compliance with India's **Digital Personal Data Protection (DPDP) Act, 2023**, raw IP addresses are **never stored** in persistent storage or log files.

#### Salted Daily HMAC Fingerprinting Algorithm
$$\text{VisitorHash} = \text{HMAC-SHA256}\Big(\text{Salt}_{\text{day}}, \ \text{IP} \parallel \text{UserAgent}\Big)$$
- $\text{Salt}_{\text{day}}$: A 256-bit cryptographically secure random string generated at `00:00:00 UTC` and stored in Redis with a 48-hour TTL.
- After 48 hours, $\text{Salt}_{\text{day}}$ is permanently deleted from Redis.
- **Result:** The system accurately counts daily unique visitors (`unique_clicks`), but reverse engineering an individual user's IP from stored logs is computationally infeasible.

```typescript
export function computeVisitorHash(ip: string, userAgent: string, dailySalt: string): string {
  return crypto
    .createHmac('sha256', dailySalt)
    .update(`${ip}:${userAgent}`)
    .digest('hex');
}
```

---

### 5.4 Outcome Attribution Engine (FR-16 - The Core Moat)
Attribution connects an outbound link click directly to an enterprise business conversion inside Jupsoft products (Fee Paid in eConnect ERP, Enquiry Logged in Admission CRM, Course Enrolled in LMS).

#### Attribution Lifecycle Flow

```
1. eConnect ERP creates payment link for Parent:
   POST /api/v1/links
   {
     "destinationUrl": "https://erp.school.edu/fee/pay?inv=INV-2026-9041",
     "externalRef": "INV-2026-9041",
     "tag": "fee_reminder_term1"
   }
   --> JLMP returns short link: https://jup.link/k8P3xZ
   
2. Parent receives SMS, taps link:
   --> Fastify logs click with linkId, tenantId, visitorHash
   --> Parent lands on payment gateway and pays fee.
   
3. Payment Gateway Webhook confirms settlement to eConnect ERP.

4. eConnect ERP notifies JLMP of conversion:
   POST /api/v1/outcomes
   {
     "externalRef": "INV-2026-9041",
     "outcomeType": "fee_paid",
     "value": 15400.00,
     "metadata": { "studentId": "STU-8841", "class": "X-A" }
   }
   
5. JLMP Attribution Worker:
   --> Matches outcomes.external_ref to links.external_ref
   --> Binds outcomes.link_id = links.id
   --> Dashboard computes Click-to-Outcome Ratio and Direct ROI.
```

---

### 5.5 Dynamic QR Code Pipeline (FR-10)
Every created link generates an associated Dynamic QR code. Because the QR code encodes the short URL (`https://jup.link/k8P3xZ`) rather than the long destination URL, modifying the destination URL in the Admin Console updates the destination dynamically **without reprinting** the physical QR code.

- **Vector Rendering:** Rendered server-side using `qrcode` or `sharp` engines.
- **Output Formats:** Scalable Vector Graphics (SVG) for high-resolution print circulars, and Portable Network Graphics (PNG) at 1024x1024 resolution.
- **Storage:** Saved directly to AWS S3 (`/tenants/{tenant_id}/qr/{link_id}.png`), served via CloudFront CDN.

---

### 5.6 Malicious URL Screening & Abuse Prevention (FR-08, FR-09)
To protect Jupsoft's short domains from blacklisting by Google Safe Browsing, Microsoft SmartScreen, and telecom spam firewalls:
1. **Synchronous Pre-Creation Screening:** Destination URLs are tested against the Google Safe Browsing v4 API / VirusTotal API upon `POST /api/v1/links`. If classified as phishing, malware, or spam, creation is blocked with HTTP 422 Unprocessable Entity.
2. **Shortener Chaining Prevention:** The API validates destinations and rejects any URL resolving to another URL shortening service (e.g., bit.ly, tinyurl.com, rb.gy, t.co).
3. **Asynchronous Periodic Re-Scanning:** A BullMQ cron worker re-scans active links weekly. If an active destination URL turns malicious post-creation, its status is immediately updated to `blocked`, Redis cache is evicted, and redirects show a neutral security warning page.

---

## 6. Detailed API Specification (RESTful / OpenAPI 3.0)

All administrative operations are exposed via a structured REST API under `/api/v1`.

### 6.1 Authentication & Rate Limiting
- **API Key Header:** `X-API-Key: jlp_live_xxxxxxxxxxxxxxxxxxxxxxxx`
- **Console JWT:** `Authorization: Bearer <jwt_token>`
- **Standard Rate Limit:** 60 requests/minute per API key for commercial tenants; 600 requests/minute for Jupsoft internal product service accounts (configurable).
- **Rate Limit Headers:**
  - `X-RateLimit-Limit: 60`
  - `X-RateLimit-Remaining: 59`
  - `X-RateLimit-Reset: 1790800060`

---

### 6.2 Endpoint Catalog

#### 1. Create Short Link
```http
POST /api/v1/links
Content-Type: application/json
X-API-Key: jlp_live_xxxxxxxxxxxxxxxx
Idempotency-Key: 7b8a5b21-4f1e-48a9-826a-d47530948b81
```
##### Request Payload
```json
{
  "destinationUrl": "https://school.jupsoft.com/admissions/apply?camp=summer26",
  "alias": "summer-admission",
  "expiresAt": "2026-12-31T23:59:59Z",
  "maxClicks": 10000,
  "tag": "admission_campaign",
  "externalRef": "ADM-CAMP-2026",
  "redirectType": "302"
}
```
##### Response Payload (HTTP 201 Created)
```json
{
  "success": true,
  "data": {
    "id": "018f3a2b-7c1e-7b2a-8d3f-1234567890ab",
    "shortCode": "k8P3xZ",
    "shortUrl": "https://jup.link/k8P3xZ",
    "aliasUrl": "https://jup.link/hw/summer-admission",
    "destinationUrl": "https://school.jupsoft.com/admissions/apply?camp=summer26",
    "qrCode": {
      "svgUrl": "https://cdn.jup.link/qr/018f3a2b-7c1e-7b2a-8d3f-1234567890ab.svg",
      "pngUrl": "https://cdn.jup.link/qr/018f3a2b-7c1e-7b2a-8d3f-1234567890ab.png"
    },
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59Z",
    "createdAt": "2026-09-29T11:48:51Z"
  }
}
```

---

#### 2. Bulk Link Creation (FR-15)
Processes up to 10,000 links asynchronously for mass SMS campaigns.
```http
POST /api/v1/links/bulk
Content-Type: application/json
X-API-Key: jlp_live_xxxxxxxxxxxxxxxx
```
##### Request Payload
```json
{
  "links": [
    {
      "destinationUrl": "https://school.jupsoft.com/fees/pay?inv=INV-001",
      "externalRef": "INV-001",
      "tag": "fee_q1"
    },
    {
      "destinationUrl": "https://school.jupsoft.com/fees/pay?inv=INV-002",
      "externalRef": "INV-002",
      "tag": "fee_q1"
    }
  ]
}
```
##### Response Payload (HTTP 202 Accepted)
```json
{
  "success": true,
  "data": {
    "jobId": "bulk_job_991823",
    "status": "queued",
    "totalCount": 2,
    "statusEndpoint": "/api/v1/links/bulk/bulk_job_991823"
  }
}
```

---

#### 3. Post Outcome Attribution Event (FR-16)
```http
POST /api/v1/outcomes
Content-Type: application/json
X-API-Key: jlp_live_xxxxxxxxxxxxxxxx
```
##### Request Payload
```json
{
  "externalRef": "INV-001",
  "outcomeType": "fee_paid",
  "value": 18500.00,
  "occurredAt": "2026-09-29T12:15:30Z",
  "metadata": {
    "paymentMode": "UPI",
    "transactionId": "TXN_776182931",
    "studentAdmissionNo": "ADM-2024-912"
  }
}
```
##### Response Payload (HTTP 201 Created)
```json
{
  "success": true,
  "data": {
    "outcomeId": "91b2c41e-3312-4aa1-9a1f-491827419201",
    "matchedLinkId": "018f3a2b-7c1e-7b2a-8d3f-1234567890ab",
    "status": "attributed"
  }
}
```

---

#### 4. Fetch Link Analytics (FR-12)
```http
GET /api/v1/links/018f3a2b-7c1e-7b2a-8d3f-1234567890ab/analytics?startDate=2026-09-01&endDate=2026-09-29
```
##### Response Payload (HTTP 200 OK)
```json
{
  "success": true,
  "data": {
    "linkId": "018f3a2b-7c1e-7b2a-8d3f-1234567890ab",
    "summary": {
      "totalClicks": 1240,
      "uniqueClicks": 980,
      "totalOutcomes": 310,
      "totalOutcomeValue": 4650000.00,
      "conversionRate": 25.0
    },
    "byDevice": { "mobile": 1100, "desktop": 120, "tablet": 20 },
    "byOS": { "Android": 850, "iOS": 250, "Windows": 100, "macOS": 40 },
    "byCountry": { "IN": 1210, "AE": 20, "US": 10 },
    "dailyTrend": [
      { "date": "2026-09-28", "clicks": 450, "uniqueClicks": 380, "outcomes": 120 },
      { "date": "2026-09-29", "clicks": 790, "uniqueClicks": 600, "outcomes": 190 }
    ]
  }
}
```

---

## 7. SMS DLT Compliance & Telecom Domain Strategy

### 7.1 TRAI DLT Regulatory Architecture
In India, the Telecom Regulatory Authority of India (TRAI) enforces strict Distributed Ledger Technology (DLT) whitelisting for all commercial telecommunications (SMS/RCS):
1. **Registered Header (Sender ID):** Each school/institution sends SMS under an approved 6-character header (e.g., `JUPSFT`, `DPSRKP`).
2. **Registered Content Template:** The message text must match an approved template containing exact variable insertion tokens `{#var#}`.
3. **Domain Whitelisting:** Any URL placed inside an SMS template must belong to a pre-whitelisted domain registered under the Principal Entity (PE) DLT account on portals such as Jio DLT, Airtel DLT, or Vodafone Idea DLT.

```
+-------------------------------------------------------------------------+
| Approved DLT SMS Template:                                              |
| "Dear Parent, fee for Term 1 is due. Pay online at {#var#}. - Jupsoft"  |
+-------------------------------------------------------------------------+
                                     |
                                     v
                        Variable matches whitelisted
                        domain: https://jup.link/k8P3xZ
```

### 7.2 Two-Domain Separation Strategy
To prevent public/commercial spam reports from causing telecom or browser blacklisting of critical school operations, JLMP mandates strict infrastructure domain segregation:

```
                            JLMP DOMAIN ISOLATION
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
[ Internal Enterprise Domain ]                            [ Public Commercial Domain ]
- Dedicated domain: e.g., jup.link                        - Dedicated domain: e.g., jups.in
- Traffic: School Fee Reminders, Admission                - Traffic: External commercial clients,
  Circulars, DigifyNext Campaigns, LMS Alerts.              marketing agencies, generic tenants.
- DLT Whitelisted on all Indian telco portals.            - Subject to strict rate limits & screening.
- Zero risk from external tenant abuse.                   - Isolated IP & reputation boundaries.
```

---

## 8. Non-Functional Requirements & Performance Benchmarks

### 8.1 Performance Targets & SLAs

| Metric | Target (MVP) | Target (Phase 2/3) | Measurement Method |
| :--- | :--- | :--- | :--- |
| **Redirect Latency (Cache Hit)** | $\mathbf{p95 < 50\text{ ms}}$ | $\mathbf{p95 < 30\text{ ms}}$ | Server response time measured at Fastify hook |
| **Redirect Latency (Cache Miss)** | $\mathbf{p95 < 150\text{ ms}}$ | $\mathbf{p95 < 80\text{ ms}}$ | Fastify DB fallback read latency |
| **Admin API Latency** | $\mathbf{p95 < 500\text{ ms}}$ | $\mathbf{p95 < 300\text{ ms}}$ | NestJS global interceptor |
| **Redirect Service Availability** | $\mathbf{99.9\%}$ monthly | $\mathbf{99.95\%}$ monthly | Cloudflare synthetic synthetic healthcheck |
| **Admin Console Availability** | $\mathbf{99.5\%}$ monthly | $\mathbf{99.9\%}$ monthly | UptimeRobot / AWS CloudWatch |
| **Concurrent Ingestion Throughput**| $\mathbf{1,000\text{ clicks/sec}}$ | $\mathbf{5,000\text{ clicks/sec}}$| BullMQ stress test benchmarks |
| **Recovery Point Objective (RPO)**| $\mathbf{\le 1\text{ hour}}$ | $\mathbf{\le 15\text{ minutes}}$ | AWS Aurora automated continuous snapshots |
| **Recovery Time Objective (RTO)** | $\mathbf{\le 4\text{ hours}}$ | $\mathbf{\le 1\text{ hour}}$ | Terraform automated recovery scripts |

### 8.2 High-Throughput Redirect Execution Flow

```
[ Client GET /k8P3xZ ]
         |
         v
[ Cloudflare Edge ] (TLS 1.3 Terminated, DDoS checked)
         |
         v
[ Fastify Server (app.get('/:code')) ]
   1. Check Redis: GET link:{domainId}:k8P3xZ
         |
         +----> [ HIT ] (Latency: ~2ms)
         |        |
         |        +---> Check if expired or max_clicks reached
         |        |       - If expired: return 302 -> /system/expired
         |        |
         |        +---> Return HTTP 302 (Location: destination_url)
         |        |
         |        +---> Non-blocking: bullmq.add('click-ingestion-queue', jobData)
         |
         +----> [ MISS ] (Latency: ~15ms)
                  |
                  +---> Query PostgreSQL links table with domain_id & short_code
                  +---> If Not Found: return HTTP 404 (Not Found Page)
                  +---> If Found:
                          - SETEX link:{domainId}:k8P3xZ 86400 <payload>
                          - Return HTTP 302 (Location: destination_url)
                          - Non-blocking: bullmq.add('click-ingestion-queue', jobData)
```

---

## 9. Security, Threat Modeling & Compliance Architecture

### 9.1 Threat Modeling & Mitigation Matrix

| Threat Vector | Severity | Attack Mechanism | Engineering Mitigation |
| :--- | :--- | :--- | :--- |
| **Domain Blacklisting (Phishing)** | Critical | Malicious tenant creates links to banking credential harvesters. | Synchronous pre-creation Google Safe Browsing API check; weekly automated re-scan; instant Super Admin domain kill-switch. |
| **Cross-Tenant Data Leakage** | Critical | Tenant queries another tenant's links or click analytics via API manipulation. | Mandatory PostgreSQL Row-Level Security (RLS) policies at the DB level; NestJS TenantGuard context verification. |
| **Click-Stream Denial of Service**| High | Botnet sends flood of HTTP requests to short links to inflate billable clicks / crash DB. | Cloudflare Bot Management; Redis rolling-window IP rate limiting; BullMQ buffer decouples ingest from DB writes. |
| **Enumeration / Brute-force Attacks**| Medium | Attacker scans `/aaaaaa`, `/aaaaab` to harvest private invoice links. | Base58 6-7 char random keyspace ($3.8\times 10^{10}$ permutations); Cloudflare rate limiting on 404 responses. |
| **Open Redirect Vulnerability** | Medium | Manipulating query parameters to redirect users to unauthorized third-party sites. | Strict protocol whitelist (`https://` or `http://` only; `javascript:`, `data:` blocked); regex sanitization. |

### 9.2 Data Localization & DPDP Act Compliance Checklist
- **Hosting Region:** Strictly AWS Asia Pacific (Mumbai) `ap-south-1`.
- **PII Storage:** Zero raw IP storage. No parent phone numbers or email addresses stored in click logs.
- **Data Retention & Automated Purge:**
  - Raw partitioned click tables are dropped after 13 months via scheduled PostgreSQL cron:
    ```sql
    DROP TABLE IF EXISTS clicks_2025_08;
    ```
  - Daily summary aggregates (`click_daily`) are retained for tenant lifetime.

---

## 10. Infrastructure, Deployment & DevOps Topology

### 10.1 Monorepo Architecture
The platform is organized as a unified TypeScript monorepo using **Turborepo** and **pnpm**:

```
jlmp-core/
├── apps/
│   ├── redirect-service/       # Fastify lightweight microservice (Hot path)
│   ├── admin-api/              # NestJS REST API & Authentication (Control plane)
│   ├── click-worker/           # BullMQ consumer background worker
│   └── web-console/            # React 19 + Vite Tenant & Super Admin SPA
├── packages/
│   ├── database/               # Drizzle/Prisma schema, migrations, RLS scripts
│   ├── redis-cache/            # Shared Redis connection pools & key factories
│   ├── shared-types/           # Common TypeScript interfaces & DTOs
│   ├── url-screening/          # Google Safe Browsing & Anti-abuse integration
│   └── logger/                 # OpenTelemetry structured JSON logging
├── infra/
│   ├── terraform/              # AWS VPC, ECS, RDS, Redis, Cloudflare resources
│   └── docker/                 # Production multi-stage Dockerfiles
├── package.json
└── turbo.json
```

### 10.2 AWS Production Infrastructure Topology

```
                       [ Cloudflare Edge Network ]
                                    | (TLS Termination & Re-encryption)
                                    v
                          [ AWS Internet Gateway ]
                                    |
                    +---------------+---------------+
                    |     VPC (10.0.0.0/16)         |
                    |   AWS Application Load        |
                    |   Balancer (ALB - Multi-AZ)   |
                    +---------------+---------------+
                                    |
          +-------------------------+-------------------------+
          | Public Subnets                                    |
          | (ALB Listeners on :443)                           |
          +-------------------------+-------------------------+
                                    |
          +-------------------------+-------------------------+
          | Private App Subnets (No direct internet ingress)   |
          |                                                   |
          |  [ ECS Fargate: Redirect Service ] (Autoscale)    |
          |  [ ECS Fargate: Admin API ]                       |
          |  [ ECS Fargate: Click Workers ]                   |
          +-------------------------+-------------------------+
                                    |
          +-------------------------+-------------------------+
          | Private Isolated Data Subnets                     |
          |                                                   |
          |  [ AWS Aurora PostgreSQL 16 (Multi-AZ) ]          |
          |  [ AWS ElastiCache Redis 7 (Cluster Mode) ]        |
          +---------------------------------------------------+
```

---

## 11. PRD Functional Requirements (FR) Traceability Matrix

Every single functional requirement from PRD v1.0 is mapped to its engineering implementation:

| PRD Req ID | PRD Requirement Description | Phase | Architecture & Code Implementation |
| :--- | :--- | :--- | :--- |
| **FR-01** | Create, suspend, reactivate tenant | MVP | Implemented in `admin-api` (`TenantsModule`). Suspended status checks in `RedirectService` return branded "Link Unavailable" HTTP 403 page. |
| **FR-02** | Manage users and 5 RBAC roles | MVP | Implemented in `admin-api` with `@Roles()` decorator and `RolesGuard`. Context verified per request. |
| **FR-03** | Create short link (<500ms SLA) | MVP | `POST /api/v1/links`. Synchronous screening + Base58 generator + Redis cache write. Meets SLA. |
| **FR-04** | Short code generation (Base62/Base58) | MVP | Modified Base58 generator without look-alikes (`0/O`, `1/l/I`), 6–7 chars. 3x collision backoff. |
| **FR-05** | Tenant-scoped readable alias | MVP | Route parser matches `/<tenant_code>/<alias>`. Reserved keywords blocked. Unique constraint on `(tenant_id, alias)`. |
| **FR-06** | Redirect engine (302/307) | MVP | Fastify route handler serving HTTP 302 by default; 301 explicitly prohibited. |
| **FR-07** | Link lifecycle (edit, disable, expire) | MVP | `links.status` flags + Redis eviction pipeline. Custom branded HTML page for expired/max-click links. |
| **FR-08** | Malicious-URL screening | MVP | `GoogleSafeBrowsingClient` pre-creation check + BullMQ weekly periodic re-screening cron. |
| **FR-09** | Public abuse reporting page | MVP | `POST /api/v1/abuse-reports` + Public `/report` web form. Super Admin review dashboard. |
| **FR-10** | Dynamic and static QR codes | MVP | Dynamic QR generation via `qrcode` engine. Saved to AWS S3 as SVG and 1024px PNG. |
| **FR-11** | Non-blocking click logging | MVP | Asynchronous dispatch to Redis BullMQ. Raw IP hashed with daily salt; raw IP never written to disk. |
| **FR-12** | Analytics dashboard & rollups | MVP | Periodic worker aggregates `clicks` into `click_daily`. REST API provides pre-calculated fast rollups. |
| **FR-13** | REST API with API keys | MVP | NestJS versioned API (`/api/v1`). OpenAPI 3.0 (Swagger) auto-generated documentation. |
| **FR-14** | API key management & rotation | MVP | SHA-256 hashed keys. Prefix-based lookup (`jlp_live_...`). Tenant Admin rotation & revocation controls. |
| **FR-15** | Bulk link creation (up to 10k) | MVP | `POST /api/v1/links/bulk`. BullMQ streaming worker with chunked database inserts & progress polling. |
| **FR-16** | Outcome attribution hooks | MVP | `POST /api/v1/outcomes`. Matches `external_ref` from eConnect ERP to `links.external_ref`. ROI metrics. |
| **FR-17** | Campaigns & UTM builder | Phase 2| Group links by `campaign_id`. Query param builder for `utm_source`, `utm_medium`, `utm_campaign`. |
| **FR-18** | Customer custom domains & SSL | Phase 2| Cloudflare for SaaS integration. Automated SSL issuance and CNAME verification polling. |
| **FR-19** | Billing, plans & metering | Phase 2| Stripe / Razorpay integration + daily link/click usage metering counters. |
| **FR-20** | White-label tenant branding | Phase 2| Custom logo, primary colors, custom 404/expired landing pages, branded PDF reports. |
| **FR-21** | Report exports (CSV, Excel, PDF) | Phase 2| Asynchronous export generator worker using Puppeteer (PDF) and ExcelJS. |

---

## 12. Resolution of PRD Open Questions & Engineering Decisions

| Open Question from PRD | Engineering Resolution / Decision |
| :--- | :--- |
| **1. Short domain selection** | **Internal:** `jup.link` (DLT whitelisted for eConnect ERP/CRM).<br>**Public Commercial:** `jups.in` (Isolated commercial tenants). |
| **2. Initial product integrations** | **Stage 1 Target:** eConnect ERP (Fee reminders via SMS) and Admission CRM (Lead enquiry forms). |
| **3. Team stack capability (.NET to Node.js)** | Monorepo structured with strict TypeScript types, NestJS (familiar to enterprise OOP/.NET developers), and unified linting/formatting rules. |
| **4. Web Console framework** | **React 19 + Vite + Tailwind CSS + Shadcn UI**. Clean, fast build times, and rich component ecosystem. |
| **5. Malicious URL screening provider** | **Google Safe Browsing Lookup API v4** (Cost-effective for high volume) with fallback to Cloudflare 1.1.1.1 security intelligence. |
| **6. SMS Vendor DLT Process** | Integration with Jupsoft's existing telecom aggregator (e.g., ValueFirst / Route Mobile). Register domain and SMS templates with variable syntax `{#var#}`. |
| **7. Pilot Schools Selection** | 5 high-volume institutional clients running eConnect ERP fee notifications to establish baseline click and payment attribution metrics. |

---

## 13. Delivery Roadmap & Technical Milestone Gates

```
+---------------------------------------------------------------------------------------+
| STAGE 0: Foundations & Compliance                                                     |
| - Acquire short domains (jup.link, jups.in)                                           |
| - Submit DLT domain whitelisting requests to Indian telecom portals                   |
| - Setup monorepo, CI/CD, AWS VPC, RDS Aurora, Redis                                  |
| [ GATE 0 ]: DLT whitelisting confirmed; Core infrastructure reachable                 |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| STAGE 1: MVP Engineering Build (FR-01 to FR-16)                                       |
| - Develop Fastify Redirect Engine & Redis cache layer                                 |
| - Develop NestJS Admin API & PostgreSQL RLS policies                                  |
| - Implement BullMQ click ingestion worker & daily aggregation pipeline                |
| - Implement Outcome Attribution API (FR-16) & ERP payment hook                        |
| - Develop React Web Console & QR code export                                         |
| [ GATE 1 ]: All 16 MVP Acceptance Criteria passed; p95 redirect latency < 50ms        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| STAGE 2: Institutional Pilot (5 Pilot Schools)                                        |
| - Rollout eConnect ERP fee reminders with JLMP links across 5 partner schools         |
| - Measure SMS character savings (reduction from multi-segment to 1 segment)           |
| - Track payment outcomes vs link clicks                                               |
| [ GATE 2 ]: Zero domain blacklisting; Measurable conversion uplift recorded           |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| STAGE 3: Ecosystem Rollout & Phase 2 Feature Build                                    |
| - Onboard Admission CRM, LMS, and DigifyNext marketing campaigns                      |
| - Build Phase 2 features: Campaigns/UTM, Custom Domains (Cloudflare for SaaS)         |
| [ GATE 3 ]: 100% of internal Jupsoft product links routed via JLMP                    |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| STAGE 4: Commercial Public Launch                                                     |
| - Activate jups.in for external commercial organizations                              |
| - Rollout self-service billing, plans, and agency multi-client management             |
+---------------------------------------------------------------------------------------+
```

---
*End of Technical Requirements Document (TRD) · Version 1.0*
