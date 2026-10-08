# Shortly API Reference: Create Link

<div align="left">
  <span style="background-color: #10B981; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px;">POST</span>
  <span style="font-family: monospace; font-size: 14px; margin-left: 8px;"><b>https://go.jupsoft.com/api/v1/links</b></span>
</div>

---

## 📖 Overview

The **Create Link** endpoint generates an enterprise-grade, high-performance branded short link. Every generated link is provisioned with sub-millisecond edge routing (HTTP 302/307), real-time vector QR codes (SVG & PNG), click-fraud security screening, automated lifecycle expiration, and conversion attribution tracking.

This API is fully idempotent, multi-tenant aware, and protected by role-based access control (RBAC).

---

## 🔐 Authentication & Headers

Requests must include either an **API Key** or a valid **Bearer JWT token**.

| Header Name | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `X-API-Key` | String | **Yes\*** | Your organization's live secret API key (starts with `jlp_live_...`). *(Alternative: `Authorization: Bearer <API_KEY>`)* |
| `Content-Type` | String | **Yes** | Must be `application/json`. |
| `Idempotency-Key` | String (UUID) | *Optional* | Unique UUIDv4 token to safely retry requests without creating duplicate short links. Cached for 24 hours. |

> [!IMPORTANT]
> **API Key Scope Requirement**: The API Key must possess at least the **`links:write`** scope or the wildcard **`*`** entitlement.

---

## 📥 Request Body Schema

The request payload must be a JSON object conforming to the following schema:

```json
{
  "destinationUrl": "https://jupsoft.com/admissions/apply?campus=north&utm_source=sms",
  "alias": "admissions-2027",
  "tag": "Marketing",
  "externalRef": "CAMP-2026-NORTH",
  "expiresAt": "2027-06-30T23:59:59.000Z",
  "maxClicks": 5000,
  "redirectType": "302"
}
```

### Parameter Reference

| Parameter | Type | Required | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `destinationUrl` | `string` | **Required** | Max 2048 chars. Must start with `http://` or `https://`. | The final target URL where visitors will be routed. |
| `alias` | `string` | *Optional* | Max 64 chars. Allowed: `a-z`, `A-Z`, `0-9`, `-`, `_`. | Custom vanity slug (e.g. `summer-sale`). If omitted, an authentic high-entropy 6-character nanoid slug is generated (e.g. `k8F2wQ`). |
| `domainId` | `string` (UUID) | *Optional* | Must belong to your tenant. | UUID of a custom domain verified in your account. Defaults to primary system domain (`go.jupsoft.com`). |
| `tag` | `string` | *Optional* | Max 64 chars. | Operational category for organizational grouping and filtering (e.g. `Marketing`, `Payment`, `Admissions`, `Notification`, `Support`). |
| `externalRef` | `string` | *Optional* | Max 128 chars. | External CRM identifier, invoice number, lead ID, or transaction reference (e.g. `INV-2026-001`, `LEAD-9942`). Used by the Outcomes & Revenue engine. |
| `expiresAt` | `string` (ISO 8601) | *Optional* | Valid future UTC timestamp (e.g. `2026-12-31T23:59:59.000Z`). | Auto-deactivation timestamp. After this time, visits return HTTP 302 to the tenant's configured expired landing page. |
| `maxClicks` | `integer` | *Optional* | Positive integer (`>= 1`). | Maximum total clicks allowed. Link automatically deactivates after reaching this threshold. |
| `redirectType` | `string` | *Optional* | Allowed: `"302"` or `"307"`. Default: `"302"`. | HTTP redirect status code. Use `302` (Found) for standard traffic; use `307` (Temporary Redirect) if preserving HTTP request method. |

---

## 📤 Response Schema

### `HTTP 201 Created`

When successfully provisioned, the API returns a standard enterprise response envelope:

```json
{
  "success": true,
  "data": {
    "id": "9379e686-7540-42c4-861c-2fc761495125",
    "shortCode": "admissions-2027",
    "short_code": "admissions-2027",
    "shortUrl": "https://go.jupsoft.com/admissions-2027",
    "aliasUrl": "https://go.jupsoft.com/admissions-2027",
    "destinationUrl": "https://jupsoft.com/admissions/apply?campus=north&utm_source=sms",
    "destination_url": "https://jupsoft.com/admissions/apply?campus=north&utm_source=sms",
    "qrCode": {
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 33 33\">...</svg>",
      "pngUrl": "https://go.jupsoft.com/api/v1/links/9379e686-7540-42c4-861c-2fc761495125/qr?format=png&size=512"
    },
    "status": "active",
    "expiresAt": "2027-06-30T23:59:59.000Z",
    "externalRef": "CAMP-2026-NORTH",
    "createdAt": "2026-10-08T06:45:10.512Z"
  }
}
```

### Response Field Definitions

* **`id`** *(UUID)*: Canonical unique identifier of the link resource.
* **`shortCode`** *(String)*: The active slug identifier.
* **`shortUrl`** *(URL)*: The complete, publicly routable short link URL ready to distribute.
* **`qrCode.svg`** *(String)*: Direct inline vector SVG markup for high-res print media and responsive UI embedding.
* **`qrCode.pngUrl`** *(URL)*: Direct CDN/API URL delivering dynamic PNG raster images (customizable via `?size=1024&theme=navy`).
* **`status`** *(String)*: Lifecycle status (`active`, `disabled`, `expired`, `blocked`, `archived`).

---

## 💻 Code Examples

### 1. cURL (Terminal / Shell)

```bash
curl -X POST "https://go.jupsoft.com/api/v1/links" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: jlp_live_27455a3a5b157c8d3ca56056947d1bf49552b36a053f0bd3" \
  -H "Idempotency-Key: e82b7db3-6d09-40ea-9b88-12c85f7a01d4" \
  -d '{
    "destinationUrl": "https://jupsoft.com/admissions-2027",
    "alias": "admissions-2027",
    "tag": "Marketing",
    "externalRef": "CAMP-2026-01",
    "expiresAt": "2027-06-30T23:59:59.000Z",
    "maxClicks": 5000
  }'
```

---

### 2. TypeScript / Node.js (Fetch & Axios)

```typescript
import { randomUUID } from 'crypto';

interface CreateLinkPayload {
  destinationUrl: string;
  alias?: string;
  tag?: string;
  externalRef?: string;
  expiresAt?: string;
  maxClicks?: number;
}

async function createShortlyLink(payload: CreateLinkPayload) {
  const apiKey = process.env.SHORTLY_API_KEY!;
  const idempotencyKey = randomUUID();

  const response = await fetch('https://go.jupsoft.com/api/v1/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Shortly API Error [${errorData.error.code}]: ${errorData.error.message}`);
  }

  const { data } = await response.json();
  console.log(`✓ Short Link Ready: ${data.shortUrl}`);
  return data;
}

// Example Execution
createShortlyLink({
  destinationUrl: 'https://jupsoft.com/fee-portal?student=10492',
  alias: 'fee-10492',
  tag: 'Payment',
  externalRef: 'INV-10492',
  maxClicks: 10,
});
```

---

### 3. Python (requests & httpx)

```python
import os
import uuid
import requests

API_KEY = os.getenv("SHORTLY_API_KEY", "jlp_live_...")
BASE_URL = "https://go.jupsoft.com/api/v1/links"

def create_short_link(destination_url: str, alias: str = None, tag: str = "General", ref: str = None):
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "Idempotency-Key": str(uuid.uuid4())
    }
    
    payload = {
        "destinationUrl": destination_url,
        "tag": tag,
        "redirectType": "302"
    }
    if alias:
        payload["alias"] = alias
    if ref:
        payload["externalRef"] = ref

    response = requests.post(BASE_URL, json=payload, headers=headers, timeout=10)
    
    if response.status_code == 201:
        data = response.json()["data"]
        print(f"✓ Short URL created: {data['shortUrl']}")
        return data
    else:
        err = response.json().get("error", {})
        raise RuntimeError(f"Link creation failed [{err.get('code')}]: {err.get('message')}")

# Usage
create_short_link(
    destination_url="https://jupsoft.com/webinar-registration",
    alias="ai-webinar",
    tag="Marketing",
    ref="WEBINAR-2026-OCT"
)
```

---

### 4. Go (Golang)

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type LinkRequest struct {
	DestinationURL string `json:"destinationUrl"`
	Alias          string `json:"alias,omitempty"`
	Tag            string `json:"tag,omitempty"`
	ExternalRef    string `json:"externalRef,omitempty"`
}

type APIResponse struct {
	Success bool `json:"success"`
	Data    struct {
		ID       string `json:"id"`
		ShortURL string `json:"shortUrl"`
	} `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func main() {
	apiKey := os.Getenv("SHORTLY_API_KEY")
	reqBody, _ := json.Marshal(LinkRequest{
		DestinationURL: "https://jupsoft.com/admissions",
		Alias:          "admissions-go",
		Tag:            "Marketing",
	})

	req, _ := http.NewRequest("POST", "https://go.jupsoft.com/api/v1/links", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result APIResponse
	json.Unmarshal(body, &result)

	if result.Success {
		fmt.Printf("✓ Generated Short Link: %s\n", result.Data.ShortURL)
	} else {
		fmt.Printf("✗ Failed: [%s] %s\n", result.Error.Code, result.Error.Message)
	}
}
```

---

### 5. PHP (cURL / Guzzle)

```php
<?php

$apiKey = getenv('SHORTLY_API_KEY');
$url = 'https://go.jupsoft.com/api/v1/links';

$payload = [
    'destinationUrl' => 'https://jupsoft.com/annual-sports',
    'alias'          => 'sports-day',
    'tag'            => 'Notification',
    'externalRef'    => 'NOTICE-SPORTS-2026'
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'X-API-Key: ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 10,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);

if ($httpCode === 201 && $result['success']) {
    echo "✓ Short Link created: " . $result['data']['shortUrl'] . PHP_EOL;
} else {
    echo "✗ Error: " . ($result['error']['message'] ?? 'Unknown error') . PHP_EOL;
}
```

---

## 🛑 Error Codes & Troubleshooting

Shortly uses standard HTTP status codes combined with standardized RFC-compliant error payloads:

```json
{
  "success": false,
  "error": {
    "code": "ALIAS_CONFLICT",
    "message": "The custom alias 'admissions-2027' is already in use by another link on this domain"
  }
}
```

### Error Reference Matrix

| HTTP Status | Error Code | Description | Recommended Resolution |
| :---: | :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Request payload failed schema validation (e.g. invalid URL or alias exceeds 64 chars). | Ensure `destinationUrl` includes `http://` or `https://` and all field bounds are met. |
| `400` | `INVALID_INPUT` | Missing required parameters or empty body. | Provide at least `destinationUrl` in JSON format. |
| `401` | `UNAUTHORIZED` | Missing `X-API-Key` or `Authorization` header. | Supply a valid API key prefixed with `jlp_live_...`. |
| `401` | `INVALID_API_KEY` | Provided API key does not exist or token hash is incorrect. | Verify API key in your console under **Settings ➔ API Keys**. |
| `401` | `KEY_REVOKED` | The API key was revoked in the console. | Generate a new API key in the Shortly console. |
| `401` | `KEY_EXPIRED` | The API key has passed its expiration date. | Rotate to an active API key. |
| `403` | `FORBIDDEN` | Key lacks the `links:write` permission scope, or domain does not belong to your tenant. | Update key scopes in the console or remove `domainId` to use your default domain. |
| `409` | `ALIAS_CONFLICT` | Requested custom `alias` is already claimed on the target domain. | Choose a different alias or omit the field for automated slug generation. |
| `429` | `RATE_LIMIT_EXCEEDED` | Exceeded API rate limits (100 req/sec per tenant). | Implement exponential backoff or use the [Bulk Ingestion API](/api/v1/links/bulk). |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected backend or database error. | Retry request using an `Idempotency-Key` header. |

---

## ⚡ Reliability & Best Practices

### 1. Always Use Idempotency Keys in Production
Network requests can time out even after the link has been created on the server. By passing `Idempotency-Key: <UUID>`, you can safely retry your POST requests without creating duplicate links or encountering `ALIAS_CONFLICT` errors:

```bash
# Request 1 (Timeout happens)
POST /api/v1/links (Idempotency-Key: abc-123) -> 504 Gateway Timeout

# Request 2 (Safe Automatic Retry)
POST /api/v1/links (Idempotency-Key: abc-123) -> 201 Created (Header: X-Idempotent-Replay: true)
```

### 2. Inspect Rate Limit Headers
Every response includes real-time rate limit telemetry:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 98
X-RateLimit-Reset: 1791442100
```

### 3. Bulk Workflows
If creating more than 10 links at a time, **do not** call this single-link endpoint in a loop. Instead, utilize `POST /api/v1/links/bulk`, which accepts up to 10,000 links in a single payload and executes asynchronously via Redis BullMQ clusters.
