# JLMP MVP Fix + E2E Testing Plan (FR-01–16)

Source: 5-agent backend audit (2026-09-30). Scope: backend only.
Run: `cd backend && npm run build && npm test` (unit: `src/tests/core.test.ts`)

## Phase 0 — 1-line quick wins (30 min)
| # | Fix | File:line | Test |
|---|---|---|---|
| 1 | `CREATE UNIQUE INDEX ON api_keys(key_hash)` migration | `db/schema.sql:206` | `EXPLAIN SELECT ... WHERE key_hash=$1` uses index |
| 2 | Block `archived`/`expired` on both hot paths: `if (status!==active)` | `routes/redirect.routes.ts:80,150` | Create → archive → cold cache (restart redis) → `GET /:code` = 302 `/system/unavailable` (not destination) |
| 3 | `new URL(referrer)` try/catch → fallback `direct` | `workers/click.worker.ts:111` | Enqueue click with `referrer:"not-a-url"` → job succeeds, `by_referrer.direct` +1 |
| 4 | `link_clicks:*` EXPIRE (min link TTL / expiresAt) | `routes/redirect.routes.ts:90` | `TTL link_clicks:*` > 0 after hit |
| 5 | Alias race: catch `uq_tenant_alias` → 409 "already taken" | `services/link.service.ts:122` | Parallel duplicate alias → 1×201 + 1×409 (no 500) |
| 6 | PATCH status allowlist `active/disabled/archived` only | `routes/links.routes.ts:38` | PATCH `expired`/`blocked` → 400 |

## Phase 1 — Screening FR-08 (critical)
| # | Fix | File:line | Test |
|---|---|---|---|
| 7 | Enqueue `queues.screening.add` on create + on PATCH destination change | `routes/links.routes.ts:98,366` + `services/link.service.ts:67` | Create bit.ly URL → job in `url-screening-queue` → verdict row; PATCH benign→malware → re-screen row |
| 8 | Remove hardcoded `CLEAN` insert; insert `pending` then worker updates | `services/link.service.ts:145` | DB `screening_results` shows `pending` before worker, `clean/phishing` after |
| 9 | Fail-closed when no API key in prod/staging (queue + flag, don't auto-clean) | `services/screening.service.ts:36` | Unset key → verdict `service_unavailable`, link NOT marked clean |
| 10 | Worker verdict fallback fix (never store `clean` on blocked link) | `workers/screening.worker.ts:26` | Shortener URL + clean SB → verdict `suspicious`, status `blocked` |
| 11 | Invalidate alias+tenant keys on worker block (4-arg call) | `workers/screening.worker.ts:53` | Block alias link → `GET /tcode/alias` = unavailable |

## Phase 2 — Auth FR-01/02/13/14
| # | Fix | File:line | Test |
|---|---|---|---|
| 12 | Rate-limiter: move to `onRequest` + IP-key for public paths | `plugins/rate-limiter.plugin.ts:16` | 61 req/min same key → 429 + headers; 200 flood `/xyz` → 429 |
| 13 | Cached auth recheck expiry/revoke (store exp in payload) | `plugins/auth.plugin.ts:33` | Revoke key → next request 403 (no 5-min window) |
| 14 | Tenant scope isolation: `tenants:*` only for super-admin keys (nullable `tenant_id` + `isSuperAdmin`) | `plugins/auth.plugin.ts:103`, `routes/tenants.routes.ts:27` | Tenant-A admin key `GET /tenants` → 403 |
| 15 | QR route: anchor auth bypass to `/:id/qr` only + tenant scope or signed URL + size cap | `routes/links.routes.ts:89,485,495` | Cross-tenant QR UUID → 404; `size=100000` → 400 |
| 16 | API-key rotate `POST /:id/rotate` + scope subset check | `routes/api-keys.routes.ts:85` | Rotate → old hash 401, new 200; `admin` creator can't mint `*` beyond own |
| 17 | DLT `PATCH /domains/:id` (verification/dlt status advance) | `routes/domains.routes.ts:62` | `pending→submitted→whitelisted` persists |
| 18 | Abuse lookup `(domain_id, short_code)` + alias support | `routes/abuse.routes.ts:29` | Same code 2 domains → correct tenant link flagged |

## Phase 3 — Clicks/Analytics FR-11/12
| # | Fix | File:line | Test |
|---|---|---|---|
| 19 | `unique_clicks` dedupe via visitor_hash per day | `workers/click.worker.ts:118,125` | Same IP+UA 3 hits → `clicks=3, unique=1`; diff UA → `unique=2` |
| 20 | Exclude bots from counter + `clicks`, separate `bot_clicks` | `workers/click.worker.ts:101,126` | WhatsApp UA 5 hits → `click_count` unchanged |
| 21 | Single authoritative counter (DB), Redis guard best-effort + reconcile | `routes/redirect.routes.ts:89`, `workers/click.worker.ts:101` | Worker rollback → Redis not stuck +1 |
| 22 | Analytics summary: separate subqueries (no JOIN fan-out) | `routes/analytics.routes.ts:82` | Link 100 clicks + 3 outcomes → `total_clicks=100` (not 300) |
| 23 | Date-range validation (400 on invalid/reversed) | `routes/analytics.routes.ts:32` | `?startDate=foo` → 400, not 500 |
| 24 | Schedule retention (BullMQ repeatable) + monthly partitions | `services/retention.service.ts:9`, `server.ts:14` | Old partition dropped, `clicks_YYYY_MM` auto-created |

## Phase 4 — Bulk/Outcome FR-15/16 + cross-cutting
| # | Fix | File:line | Test |
|---|---|---|---|
| 25 | Bulk per-item `domainId` + tenant ownership check | `routes/links.routes.ts:185`, `workers/bulk.worker.ts:25` | Custom domain bulk → links on that domain |
| 26 | Bulk: batch transaction + QR off-loop + audit + cache prime | `workers/bulk.worker.ts:20` | 500-batch < 60s, cache hit on first redirect, audit rows present |
| 27 | CSV parser: real parser + strict header + pre-validate + size cap | `routes/links.routes.ts:61` | `"a, b"` quoted comma parses; data row with `url` in URL not eaten |
| 28 | Outcome: accept `linkId` + time-window match; ledger (append-only) + `eventId` idempotency | `services/outcome.service.ts:23,34` | Same key 2nd conversion → 2 rows; reused externalRef → correct link |
| 29 | Attribution report includes unmatched count | `services/outcome.service.ts:75` | Unmatched outcome → `unmatched=N` visible |
| 30 | Idempotency: only 2xx, body-hash key, include PATCH/DELETE | `plugins/idempotency.plugin.ts:21` | Retry fixed body → no stale error replay |
| 31 | Audit: log clone/bulk/outcome + alert on failure | `services/audit.service.ts:37` | Clone → `link.clone` row exists |
| 32 | Error map: `FST_ERR_VALIDATION`, alias-taken 409, screening 400 | `plugins/error-handler.plugin.ts:9` | Duplicate alias → 409 JSON, not 500 HTML |
| 33 | Net defaults: `CORS` allowlist, `TRUST_PROXY=false` default | `config/env.ts:20`, `app.ts:42` | Default boot has no `*` + credentials combo |

## E2E matrix (per FR, happy + edge)
- FR-01: create → suspend → `GET /:code`=unavailable → reactivate → redirect OK
- FR-02: invite manager → role stored; `read_only` key can't write (after role→scope map)
- FR-03/04/05: create → 201 + shortUrl + QR; 50 codes Base57 check; duplicate alias → 409
- FR-06: 302 default, 307 opt-in; reserved `/api` → 404
- FR-07: edit dest → cache invalidated; clone → new code; archive → unavailable; expired → expired page; maxClicks=2 → 3rd hit expired page
- FR-08: shortener URL → 400; SB-flagged → blocked + unavailable
- FR-09: report → pending row; moderate block+suspend → link down + tenant down
- FR-10: `/:id/qr?format=png/svg` 200 image; destination edit → same QR still works
- FR-11: click → `clicks` row (hashed, no IP) + counter +1 + rollup +1
- FR-12: link analytics + summary reconcile with DB counts
- FR-13: no key → 401; bad key → 401; envelope `{success,data}` consistent
- FR-14: create → list (no hash) → rotate → old dead → revoke → 403
- FR-15: 100-CSV bulk → 202 → poll → completed/failed counts; status 404 on bad jobId
- FR-16: link with externalRef → post outcome → attributed; double post same eventId → 1 row; report clicks vs outcomes match

## New E2E test files (to add)
- `src/tests/e2e-redirect.test.ts` (FR-03–07,11): needs PG+Redis (use `db-setup.ts` + test tenant/key)
- `src/tests/e2e-abuse-screening.test.ts` (FR-08/09)
- `src/tests/e2e-bulk-outcome.test.ts` (FR-15/16)
- Extend `src/tests/core.test.ts` (pure unit, no infra): alphabet size, CSV edge, verdict enum, Redis keys

## Acceptance gate
`npm run build && npm test` green + all E2E matrix rows pass against local PG+Redis + `node scripts/db-setup` seed. No `any` new 500s on edge inputs.
