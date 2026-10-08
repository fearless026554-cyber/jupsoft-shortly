# Jupsoft Shortly — Enterprise API & Integration Guide (v1.0)

> **Document Version:** 1.0.0  
> **Target Audience:** Enterprise Software Engineers, ERP Developers, Core Integration Teams  
> **Base Production URL:** `https://go.jupsoft.com`  
> **API Version Prefix:** `/api/v1`  
> **Default Protocol:** HTTPS (TLS 1.3 enforced)

---

## Table of Contents
1. [Executive Architecture Overview](#1-executive-architecture-overview)
2. [Authentication & Security Controls](#2-authentication--security-controls)
3. [Standard Request & Response Envelopes](#3-standard-request--response-envelopes)
4. [Link Management APIs](#4-link-management-apis)
   - [Create Branded Link (`POST /api/v1/links`)](#41-create-single-short-link)
   - [Bulk Link Generation (`POST /api/v1/links/bulk`)](#42-bulk-link-generation-for-sms--whatsapp)
   - [Update / Edit Link (`PATCH /api/v1/links/:id`)](#43-update--edit-existing-link)
   - [List & Query Links (`GET /api/v1/links`)](#44-list--query-links)
   - [Retrieve Single Link (`GET /api/v1/links/:id`)](#45-retrieve-single-link)
   - [Archive or Delete Link (`DELETE /api/v1/links/:id`)](#46-archive-or-delete-link)
5. [Dynamic Vector & Raster QR Studio API](#5-dynamic-vector--raster-qr-studio-api)
6. [Outcomes & Revenue Attribution API](#6-outcomes--revenue-attribution-api)
   - [Record Outcome / Payment (`POST /api/v1/outcomes`)](#61-record-conversion--revenue-outcome)
   - [Query Attribution Metrics (`GET /api/v1/outcomes/attribution`)](#62-query-attribution-metrics)
7. [Analytics & Telemetry Reporting API](#7-analytics--telemetry-reporting-api)
8. [End-to-End Enterprise ERP Blueprint (Fees & SMS Campaigns)](#8-end-to-end-enterprise-erp-blueprint)
9. [Multi-Language SDK & Integration Code Examples](#9-multi-language-code-examples)
   - [cURL](#curl)
   - [JavaScript / TypeScript (Node.js & Axios)](#javascript--typescript-nodejs)
   - [Python (3.8+)](#python)
   - [PHP / Laravel](#php--laravel)
10. [Error Handling, HTTP Status Codes & Rate Limiting](#10-error-handling-and-rate-limiting)

---

## 1. Executive Architecture Overview

**Jupsoft Shortly** is an enterprise-grade URL shortening, routing, dynamic QR, and revenue-attribution platform designed to handle mission-critical communication pipelines (school fee reminders, automated admission notices, exam hall tickets, marketing campaigns, and transactional SMS/WhatsApp dispatches).

### Key Architectural Characteristics:
* **Sub-Millisecond Edge Routing:** Powered by Redis in-memory lookup (`O(1)` time complexity) and Fastify/NestJS high-throughput routing engine.
* **Non-Blocking Telemetry Ingestion:** Click telemetry (IP, Country, Device, Browser, OS, Referrer) is processed asynchronously via background queues (BullMQ/Redis) without adding latency to visitor redirects.
* **Strict Multi-Tenancy & Row-Level Security (RLS):** Every resource is cryptographically isolated by tenant boundaries.
* **Enterprise Idempotency:** Financial and bulk link creation requests support `Idempotency-Key` headers to prevent duplicate link generation during network retries.

---

## 2. Authentication & Security Controls

Every API request to private endpoints must be authenticated using an **Enterprise API Key** generated from the Jupsoft Shortly Dashboard (`Settings ➔ API Keys`).

### Authentication Headers

You can authenticate using either header convention:

```http
Authorization: Bearer jlp_live_xxxxxxxxxxxxxxxxxxxxxxxx
```
*or*
```http
X-API-Key: jlp_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

### API Key Scopes (RBAC)

API keys are provisioned with fine-grained principle-of-least-privilege scopes:

| Scope | Privilege Description |
| :--- | :--- |
| `*` | **Full Wildcard Super Admin**: Access to all resources and management APIs. |
| `links:write` | Ability to create, update, clone, and delete short links. |
| `links:read` | Query, filter, and fetch link details and QR codes. |
| `outcomes:write` | Record payment conversions, fee submissions, and invoice settlements. |
| `analytics:read` | Read aggregate clicks, device distributions, and geographic telemetry. |

---

## 3. Standard Request & Response Envelopes

### Universal Success Response Schema

All successful responses wrap the payload in an enterprise envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-10-08T12:00:00.000Z",
    "requestId": "req_88f921ea"
  }
}
```

### Universal Error Response Schema

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "destinationUrl must be a valid HTTP or HTTPS URL.",
    "details": [
      { "field": "destinationUrl", "issue": "Invalid URL format" }
    ]
  }
}
```

---

## 4. Link Management APIs

### 4.1 Create Single Short Link

Creates an edge-routed branded short link with optional expiration, custom slug, and ERP reference.

* **Method:** `POST`
* **Path:** `/api/v1/links`
* **Headers:**
  * `Authorization: Bearer <API_KEY>`
  * `Content-Type: application/json`
  * `Idempotency-Key: <UUIDv4>` *(Optional, recommended)*

#### Request Body:

```json
{
  "destinationUrl": "https://erp.jupsoft.com/fees/pay?student_id=9402&month=oct",
  "alias": "fee-oct-9402",
  "tag": "School-Fees",
  "externalRef": "INV-2026-OCT-9402",
  "expiresAt": "2026-10-31T23:59:59.000Z",
  "maxClicks": 100
}
```

#### Field Specifications:

| Parameter | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `destinationUrl` | `string` | **Yes** | Max 2048 chars | Destination landing page. Must start with `http://` or `https://`. |
| `alias` | `string` | No | 3-64 chars (`a-z, 0-9, -, _`) | Custom vanity slug (e.g. `fee-oct-9402`). If omitted, a high-entropy 6-character code is auto-generated. |
| `tag` | `string` | No | Max 64 chars | Categorical tag for filtering (e.g. `Admissions`, `Fees`, `Sports`). |
| `externalRef` | `string` | No | Max 128 chars | ERP invoice number, Roll number, or Ticket ID. Linked directly to the Outcome Revenue engine. |
| `expiresAt` | `string` | No | ISO 8601 UTC string | Time after which the link automatically deactivates and redirects to an expiration fallback page. |
| `maxClicks` | `number` | No | Integer `>= 1` | Maximum lifetime clicks permitted before auto-deactivation. |

#### Sample Response (`HTTP 201 Created`):

```json
{
  "success": true,
  "data": {
    "id": "c71a3964-b0cf-46d5-a337-14251cb8242a",
    "shortCode": "fee-oct-9402",
    "shortUrl": "https://go.jupsoft.com/fee-oct-9402",
    "destinationUrl": "https://erp.jupsoft.com/fees/pay?student_id=9402&month=oct",
    "status": "active",
    "externalRef": "INV-2026-OCT-9402",
    "tag": "School-Fees",
    "clickCount": 0,
    "expiresAt": "2026-10-31T23:59:59.000Z",
    "createdAt": "2026-10-08T12:00:00.000Z"
  }
}
```

---

### 4.2 Bulk Link Generation (for SMS & WhatsApp)

Ideal for generating thousands of personalized links in a single atomic batch for school-wide SMS or WhatsApp broadcasts.

* **Method:** `POST`
* **Path:** `/api/v1/links/bulk`

#### Request Body:

```json
{
  "links": [
    {
      "destinationUrl": "https://erp.jupsoft.com/fees/pay?inv=1001",
      "externalRef": "INV-2026-1001",
      "tag": "Class-10-Fees",
      "alias": "pay-1001"
    },
    {
      "destinationUrl": "https://erp.jupsoft.com/fees/pay?inv=1002",
      "externalRef": "INV-2026-1002",
      "tag": "Class-10-Fees",
      "alias": "pay-1002"
    }
  ]
}
```

#### Response (`HTTP 201 Created`):

```json
{
  "success": true,
  "data": {
    "totalSubmitted": 2,
    "successful": 2,
    "failed": 0,
    "items": [
      {
        "id": "e91b...",
        "shortCode": "pay-1001",
        "shortUrl": "https://go.jupsoft.com/pay-1001",
        "externalRef": "INV-2026-1001"
      },
      {
        "id": "e92c...",
        "shortCode": "pay-1002",
        "shortUrl": "https://go.jupsoft.com/pay-1002",
        "externalRef": "INV-2026-1002"
      }
    ]
  }
}
```

---

### 4.3 Update / Edit Existing Link

Instantly modifies target destination, lifecycle status, timer expiration, or tags. **Invalidates Redis edge cache within milliseconds.**

* **Method:** `PATCH`
* **Path:** `/api/v1/links/:id`

#### Request Body:

```json
{
  "destinationUrl": "https://erp.jupsoft.com/fees/new-payment-gateway?id=9402",
  "status": "active",
  "expiresAt": "2026-11-15T23:59:59.000Z",
  "tag": "Fees-Extended"
}
```

#### Response (`HTTP 200 OK`):

```json
{
  "success": true,
  "data": {
    "id": "c71a3964-b0cf-46d5-a337-14251cb8242a",
    "destinationUrl": "https://erp.jupsoft.com/fees/new-payment-gateway?id=9402",
    "status": "active",
    "updatedAt": "2026-10-08T12:05:00.000Z"
  }
}
```

---

### 4.4 List & Query Links

* **Method:** `GET`
* **Path:** `/api/v1/links?limit=50&cursor=...`

#### Query Parameters:
* `limit` *(integer, optional, default: 50, max: 100)*: Items per page.
* `cursor` *(string, optional)*: Keyset pagination token.

---

### 4.5 Retrieve Single Link

* **Method:** `GET`
* **Path:** `/api/v1/links/:id`

---

### 4.6 Archive or Delete Link

* **Method:** `DELETE`
* **Path:** `/api/v1/links/:id`
  * Default: Moves link to **Archive** (can be restored).
  * Hard Permanent Delete: `/api/v1/links/:id?permanent=true` (Super Admin privilege required).

---

## 5. Dynamic Vector & Raster QR Studio API

Generate dynamic QR codes for print media (ID cards, admission flyers, report cards, fee challans). When the destination URL of the short link is edited, the printed QR code **automatically routes to the new destination** without reprinting.

* **Method:** `GET`
* **Path:** `/api/v1/links/:id/qr`

#### Query Parameters:
* `format`: `png` *(raster)* or `svg` *(vector for high-res print)*.
* `size`: Integer pixels between `120` and `2048` (e.g. `1024`). Default: `512`.
* `margin`: Quiet zone border width (default: `2`).

#### Examples:
```bash
# Download 1024px High-Res PNG for Print
curl -O "https://go.jupsoft.com/api/v1/links/c71a3964-b0cf-46d5-a337-14251cb8242a/qr?format=png&size=1024"

# Fetch Vector SVG for Web / App
curl "https://go.jupsoft.com/api/v1/links/c71a3964-b0cf-46d5-a337-14251cb8242a/qr?format=svg"
```

---

## 6. Outcomes & Revenue Attribution API

Connects transaction success callbacks from payment gateways (Razorpay, PayU, Cashfree, Stripe) or School ERPs directly to the campaign short link.

### 6.1 Record Conversion / Revenue Outcome

* **Method:** `POST`
* **Path:** `/api/v1/outcomes`

#### Request Body:

```json
{
  "externalRef": "INV-2026-OCT-9402",
  "outcomeType": "Payment",
  "value": 15000,
  "eventId": "pay_razorpay_99812481",
  "metadata": {
    "studentName": "Aarav Sharma",
    "class": "10-A",
    "paymentMode": "UPI"
  }
}
```

#### Field Specifications:

| Field | Type | Description |
| :--- | :--- | :--- |
| `externalRef` | `string` | **Crucial:** Must match the `externalRef` assigned to the short link during creation. |
| `outcomeType` | `string` | Allowed: `"Payment"`, `"Form"`, `"Registration"`, `"Lead"`. |
| `value` | `number` | Numeric currency amount collected (e.g. `15000.00`). |
| `eventId` | `string` | Optional transaction ID from gateway to ensure idempotent, non-duplicate processing. |
| `metadata` | `object` | Arbitrary JSON payload with custom business attributes. |

#### Attribution Behavior:
1. System queries the database for the link that possesses `external_ref = 'INV-2026-OCT-9402'`.
2. The outcome record is attributed (`status: "attributed"`) to `links.id`.
3. Total Revenue, Conversions count, and Conversion Rate (`Conversions / Clicks`) are updated instantaneously.

---

### 6.2 Query Attribution Metrics

* **Method:** `GET`
* **Path:** `/api/v1/outcomes/attribution`

#### Response:

```json
{
  "success": true,
  "data": {
    "totalLinks": 150,
    "totalClicks": 3420,
    "totalOutcomes": 890,
    "totalRevenueAttributed": 13350000,
    "conversionRate": 26.02,
    "avgValue": 15000.00
  }
}
```

---

## 7. Analytics & Telemetry Reporting API

Pull high-resolution engagement telemetry directly into your ERP dashboards.

### 7.1 Aggregate Account Telemetry

* **Method:** `GET`
* **Path:** `/api/v1/analytics/summary?startDate=2026-10-01&endDate=2026-10-31`

#### Response Data Breakdown:
* `totalClicks`: Cumulative raw redirects.
* `uniqueClicks`: Deduplicated visitor sessions.
* `devices`: Breakdown across `Mobile`, `Desktop`, `Tablet`.
* `operatingSystems`: `Android`, `iOS`, `Windows`, `macOS`, `Linux`.
* `browsers`: `Chrome`, `Safari`, `Firefox`, `Edge`.
* `topReferrers`: Direct / SMS, WhatsApp, Google, Facebook.

### 7.2 Link-Specific Analytics

* **Method:** `GET`
* **Path:** `/api/v1/analytics/links/:id`

---

## 8. End-to-End Enterprise ERP Blueprint

```
+-----------------------------------------------------------------------------------+
|                            Jupsoft School ERP Workflow                            |
+-----------------------------------------------------------------------------------+
                                      |
       Step 1: Fee Invoices Generated for 1,000 Students in Class 10
                                      |
                                      v
       Step 2: ERP calls Shortly Bulk API:
               POST /api/v1/links/bulk
               with externalRef = Invoice # (e.g. INV-1001, INV-1002...)
                                      |
                                      v
       Step 3: ERP receives Branded Short URLs (https://go.jupsoft.com/fee-1001)
               Dispatches SMS/WhatsApp notifications to parents
                                      |
                                      v
       Step 4: Parent clicks Short Link -> Redirected via Redis in <2ms
               Clicks counter increments by +1
                                      |
                                      v
       Step 5: Parent completes Payment on Payment Gateway / ERP
                                      |
                                      v
       Step 6: Payment Gateway Webhook calls Shortly:
               POST /api/v1/outcomes
               { externalRef: "INV-1001", value: 15000, outcomeType: "Payment" }
                                      |
                                      v
       Step 7: Shortly joins Outcome with Link
               School Management Dashboard shows:
               Revenue: ₹15,000 | Conversions: 1 | Rate: 100%
```

---

## 9. Multi-Language Code Examples

### cURL

```bash
# 1. Create a Short Link
curl -X POST "https://go.jupsoft.com/api/v1/links" \
  -H "Authorization: Bearer jlp_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "destinationUrl": "https://erp.jupsoft.com/fees/pay?inv=INV-2026-001",
    "alias": "fee-inv-001",
    "externalRef": "INV-2026-001",
    "tag": "Fees"
  }'

# 2. Record Payment Outcome
curl -X POST "https://go.jupsoft.com/api/v1/outcomes" \
  -H "Authorization: Bearer jlp_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalRef": "INV-2026-001",
    "outcomeType": "Payment",
    "value": 15000
  }'
```

---

### JavaScript / TypeScript (Node.js)

```typescript
import axios from 'axios';

const SHORTLY_API = 'https://go.jupsoft.com/api/v1';
const API_KEY = process.env.SHORTLY_API_KEY!;

const client = axios.create({
  baseURL: SHORTLY_API,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

// Create Short Link for a Student
async function createFeeLink(studentId: string, invoiceNo: string, amount: number) {
  const response = await client.post('/links', {
    destinationUrl: `https://erp.jupsoft.com/fees/pay?student=${studentId}&inv=${invoiceNo}`,
    alias: `fee-${studentId}-${invoiceNo.toLowerCase()}`,
    externalRef: invoiceNo,
    tag: 'School-Fees',
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days
  });

  return response.data.data.shortUrl;
}

// Payment Gateway Callback
async function handlePaymentSuccess(invoiceNo: string, amountPaid: number, transactionId: string) {
  await client.post('/outcomes', {
    externalRef: invoiceNo,
    outcomeType: 'Payment',
    value: amountPaid,
    eventId: transactionId,
  });
}
```

---

### Python

```python
import requests
import os

BASE_URL = "https://go.jupsoft.com/api/v1"
API_KEY = os.environ.get("SHORTLY_API_KEY")

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def generate_campaign_link(target_url: str, ref_id: str, campaign_tag: str) -> str:
    payload = {
        "destinationUrl": target_url,
        "externalRef": ref_id,
        "tag": campaign_tag
    }
    res = requests.post(f"{BASE_URL}/links", json=payload, headers=headers, timeout=5)
    res.raise_for_status()
    data = res.json()
    return data["data"]["shortUrl"]

def register_payment(ref_id: str, amount: float, tx_id: str):
    payload = {
        "externalRef": ref_id,
        "outcomeType": "Payment",
        "value": amount,
        "eventId": tx_id
    }
    res = requests.post(f"{BASE_URL}/outcomes", json=payload, headers=headers, timeout=5)
    return res.json()
```

---

### PHP / Laravel

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class ShortlyService
{
    protected string $baseUrl = 'https://go.jupsoft.com/api/v1';
    protected string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.shortly.key');
    }

    /**
     * Generate branded short link for fee dispatch.
     */
    public function createShortLink(string $targetUrl, string $invoiceNo, string $tag = 'Fees'): ?string
    {
        $response = Http::withToken($this->apiKey)
            ->timeout(5)
            ->post("{$this->baseUrl}/links", [
                'destinationUrl' => $targetUrl,
                'externalRef'    => $invoiceNo,
                'tag'            => $tag,
            ]);

        if ($response->successful()) {
            return $response->json('data.shortUrl');
        }

        return null;
    }

    /**
     * Record payment outcome on webhook callback.
     */
    public function recordOutcome(string $invoiceNo, float $amount, string $transactionId): bool
    {
        $response = Http::withToken($this->apiKey)
            ->timeout(5)
            ->post("{$this->baseUrl}/outcomes", [
                'externalRef' => $invoiceNo,
                'outcomeType' => 'Payment',
                'value'       => $amount,
                'eventId'     => $transactionId,
            ]);

        return $response->successful();
    }
}
```

---

## 10. Error Handling and Rate Limiting

### Standard HTTP Status Codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `200` | **OK** | Request completed successfully. |
| `201` | **Created** | Short link or resource provisioned successfully. |
| `400` | **Bad Request** | Missing required fields, invalid URL scheme, or validation error. |
| `401` | **Unauthorized** | Missing or malformed `Authorization: Bearer <API_KEY>` header. |
| `403` | **Forbidden** | API key lacks required scope (e.g. attempting to write with read-only key). |
| `404` | **Not Found** | The specified Link ID or resource does not exist. |
| `409` | **Conflict** | Vanity alias already claimed by another active link. |
| `429` | **Too Many Requests** | Exceeded tenant rate limit threshold. Back off and retry. |
| `500` | **Internal Error** | Unexpected server condition. Retry with exponential backoff. |

### Enterprise Rate Limits
* **Standard Tier:** 120 requests/minute per API Key.
* **Bulk Import Tier:** 30 batches/minute (up to 1,000 links per batch).
* **Redirect Edge Rate:** Uncapped / protected by Redis token bucket (10,000+ req/sec).

---

© 2026 Jupsoft Technologies. All rights reserved. Confidential enterprise documentation.
