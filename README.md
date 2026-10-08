# Jupsoft Shortly — Enterprise Link Management & Revenue Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16%20Turbopack-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-Fastify%20Core-E0234E)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20RLS-336791)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Edge%20Cache-DC382D)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6)](https://www.typescriptlang.org/)

**Jupsoft Shortly** (`go.jupsoft.com`) is a high-throughput, enterprise-grade URL shortening, routing, dynamic vector QR generation, and financial outcome/conversion attribution platform. It is engineered specifically for institutions and multi-tenant organizations managing mass communication pipelines (such as school fee reminders, admission notices, exam hall tickets, marketing campaigns, and transactional SMS/WhatsApp dispatches).

---

## 🚀 Key Capabilities

* **Sub-Millisecond Edge Routing:** Redis in-memory cache lookup (`O(1)`) + NestJS/Fastify engine delivers edge redirection in < 2ms.
* **Inline Canvas Drawer Management:** Inspect, change timer expirations, download dynamic vector QR codes, and edit target destination URLs directly without disruptive full-page reloads.
* **Dynamic Vector & Raster QR Studio:** Real-time generation of 1024px PNGs and SVG vector QR codes that auto-update when the target destination changes.
* **Bulk Dispatch Engine:** Atomic creation of thousands of branded links via JSON or CSV for school-wide SMS/WhatsApp campaigns.
* **Outcomes & Revenue Attribution:** Automatically links payment gateway webhooks (Razorpay, PayU, Cashfree) and ERP transactions back to individual short links via `external_ref`.
* **Enterprise Multi-Tenancy & RBAC:** Cryptographically isolated tenant data with PostgreSQL Row-Level Security (RLS) and scoped API keys.
* **Heuristics & Anti-Abuse Screening:** Real-time destination validation to prevent phishing and spam links.

---

## 📚 Documentation Index

* 📘 **[Enterprise API & Integration Guide](./docs/ENTERPRISE_API_INTEGRATION_GUIDE.md):** Complete developer reference for ERP and external systems, including authentication, schemas, and code examples in Node.js, Python, PHP/Laravel, and cURL.
* 📗 **[Create Link API Reference](./docs/api-reference-create-link.md):** Detailed parameter constraints and response breakdown for the single link endpoint.
* 📙 **[Technical Requirements Document (TRD)](./docs/JLMP_Technical_Requirements_Document_TRD_v1.0.md):** Architectural specifications and infrastructure blueprints.

---

## 🛠️ Tech Stack & Architecture

```
                                +---------------------------+
                                |  Next.js 16 (App Router)  |
                                |  Tailwind CSS + Lucide    |
                                +-------------+-------------+
                                              |
                                     Reverse Proxy / API
                                              v
                                +---------------------------+
                                | NestJS 10 + Fastify Core  |
                                | High-Performance REST API |
                                +------+--------------+-----+
                                       |              |
                      +----------------+              +----------------+
                      v                                                v
            +-------------------+                            +-------------------+
            | PostgreSQL 16 DB  |                            | Redis 7 In-Memory |
            | Multi-Tenant RLS  |                            | Edge Cache & Rate |
            +-------------------+                            +-------------------+
```

---

## 💻 Quick Start & Development

### Prerequisites
* Node.js `>= 20.x`
* PostgreSQL `>= 16.x`
* Redis `>= 7.x`
* pnpm or npm

### Backend Setup
```bash
cd backend-nestjs
npm install
npm run build
npm run start:prod # or npm run start:dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run start # or npm run dev
```

---

## 🔒 Enterprise API Key Integration

Every API request requires an enterprise API key in the `Authorization` header:

```bash
curl -X POST "https://go.jupsoft.com/api/v1/links" \
  -H "Authorization: Bearer jlp_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "destinationUrl": "https://erp.jupsoft.com/fees/pay?inv=INV-2026-001",
    "alias": "fee-inv-001",
    "externalRef": "INV-2026-001",
    "tag": "Fees"
  }'
```

See **[Enterprise API & Integration Guide](./docs/ENTERPRISE_API_INTEGRATION_GUIDE.md)** for full details.

---

© 2026 Jupsoft Technologies. All rights reserved.
