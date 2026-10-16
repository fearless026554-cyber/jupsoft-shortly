'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Code2,
  Terminal,
  Key,
  Clock,
  AlertTriangle,
  Check,
  Copy,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Layers,
  ChevronRight,
  ChevronLeft,
  Server,
  Globe,
  Database,
  ArrowUpRight,
  Link2,
  FileSpreadsheet,
  QrCode,
  BarChart3,
  DollarSign,
  Activity,
  Lock,
  Sparkles,
  Trash2,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { useTenantDomains } from '../../hooks/useTenantDomains';

export type Framework = 'curl' | 'node' | 'python';

interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

interface EndpointDoc {
  id: string;
  category: 'Links' | 'Bulk & Batch' | 'QR Studio' | 'Analytics' | 'Outcomes' | 'System';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  title: string;
  summary: string;
  description: string;
  params?: EndpointParam[];
  requestBody?: {
    contentType: string;
    schema: string;
    example: any;
  };
  response: {
    status: number;
    description: string;
    example: any;
  };
  snippets: {
    curl: string;
    node: string;
    python: string;
  };
}

interface ApiDocsViewProps {
  onNavigateToApiKeys?: () => void;
  currentUser?: any;
}

export const ApiDocsView: React.FC<ApiDocsViewProps> = ({ onNavigateToApiKeys, currentUser }) => {
  const { defaultDomain } = useTenantDomains();
  const [selectedFramework, setSelectedFramework] = useState<Framework>('curl');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>('intro');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedErrorTab, setSelectedErrorTab] = useState<string>('400');

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/v1`
    : `https://${defaultDomain || 'go.jupsoft.com'}/api/v1`;

  const domainHost = defaultDomain || 'go.jupsoft.com';

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Sync hash on mount and hash changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash) {
        setActiveSection(hash);
      }
    }
  }, []);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Endpoint Catalog
  const endpoints: EndpointDoc[] = useMemo(() => [
    {
      id: 'create-link',
      category: 'Links',
      method: 'POST',
      path: '/links',
      title: 'Create Short Link',
      summary: 'Generate a sub-2ms branded short link with custom slug, tags, expiration, and tracking.',
      description: 'Creates a new branded short link routed through Shortly edge cache. Supports custom aliases, click caps, TRAI 160-char SMS optimization, and permanent link protection.',
      params: [
        { name: 'destinationUrl', type: 'string (URL)', required: true, description: 'The absolute target HTTP or HTTPS address to redirect to.', example: 'https://example.com/promotions/spring-sale' },
        { name: 'slug', type: 'string (3-64 chars)', required: false, description: 'Custom alphanumeric short code alias. If omitted, Shortly auto-generates a 6-character nanoid.', example: 'spring26' },
        { name: 'isPermanent', type: 'boolean', required: false, description: 'When true, marks link as permanent. Delete operations require Super Admin or Admin authorization with multi-step confirmation.', example: 'true' },
        { name: 'externalRef', type: 'string', required: false, description: 'ERP, CRM, or order identifier (e.g. INV-9041) for closed-loop outcome attribution.', example: 'INV-2026-001' },
        { name: 'tags', type: 'string[]', required: false, description: 'Array of classification tags for segmenting analytics.', example: '["promo", "sms", "spring"]' },
        { name: 'expiresAt', type: 'string (ISO 8601)', required: false, description: 'UTC timestamp after which link expires and redirects to fallback destination.', example: '2026-12-31T23:59:59Z' },
        { name: 'maxClicks', type: 'integer', required: false, description: 'Maximum total clicks allowed before automatic link deactivation.', example: '5000' },
      ],
      requestBody: {
        contentType: 'application/json',
        schema: 'CreateLinkDto',
        example: {
          destinationUrl: 'https://example.com/promotions/spring-sale',
          slug: 'spring26',
          isPermanent: false,
          externalRef: 'INV-2026-001',
          tags: ['promo', 'sms', 'spring'],
          expiresAt: '2026-12-31T23:59:59Z',
          maxClicks: 5000,
        },
      },
      response: {
        status: 201,
        description: 'Link created successfully and cached in edge Redis nodes.',
        example: {
          success: true,
          data: {
            id: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04',
            shortCode: 'spring26',
            shortUrl: `https://${domainHost}/spring26`,
            destinationUrl: 'https://example.com/promotions/spring-sale',
            status: 'active',
            clicksCount: 0,
            isPermanent: false,
            externalRef: 'INV-2026-001',
            tags: ['promo', 'sms', 'spring'],
            createdAt: '2026-10-14T10:00:00.000Z',
          },
        },
      },
      snippets: {
        curl: `curl -X POST "${baseUrl}/links" \\
  -H "X-Api-Key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "destinationUrl": "https://example.com/promotions/spring-sale",
    "slug": "spring26",
    "isPermanent": false,
    "externalRef": "INV-2026-001",
    "tags": ["promo", "sms", "spring"],
    "maxClicks": 5000
  }'`,
        node: `// Node.js (v18+ native fetch)
const res = await fetch('${baseUrl}/links', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.SHORTLY_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    destinationUrl: 'https://example.com/promotions/spring-sale',
    slug: 'spring26',
    isPermanent: false,
    externalRef: 'INV-2026-001',
    tags: ['promo', 'sms', 'spring'],
    maxClicks: 5000,
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error('Shortly Error:', data.error);
} else {
  console.log('Short URL created:', data.data.shortUrl);
}`,
        python: `# Python (requests)
import os
import requests

url = "${baseUrl}/links"
headers = {
    "X-Api-Key": os.getenv("SHORTLY_API_KEY", "sk_live_..."),
    "Content-Type": "application/json",
}
payload = {
    "destinationUrl": "https://example.com/promotions/spring-sale",
    "slug": "spring26",
    "isPermanent": False,
    "externalRef": "INV-2026-001",
    "tags": ["promo", "sms", "spring"],
    "maxClicks": 5000,
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()

if response.status_code == 201:
    print(f"Created short URL: {data['data']['shortUrl']}")
else:
    print(f"Error ({response.status_code}): {data.get('error')}")`,
      },
    },
    {
      id: 'list-links',
      category: 'Links',
      method: 'GET',
      path: '/links',
      title: 'List Short Links',
      summary: 'Retrieve paginated links for your organization with search and status filtering.',
      description: 'Returns a list of links matching query criteria. Supports cursor and page-based pagination, search by destination or alias, and filtering by active/archived/permanent state.',
      params: [
        { name: 'page', type: 'integer', required: false, description: 'Page number for pagination (defaults to 1).', example: '1' },
        { name: 'limit', type: 'integer (1-100)', required: false, description: 'Maximum number of items to return per page (defaults to 20).', example: '20' },
        { name: 'search', type: 'string', required: false, description: 'Keyword query matching slug, destination URL, or external reference.', example: 'spring' },
        { name: 'status', type: 'string', required: false, description: 'Filter by link lifecycle state: "active", "archived", or "all".', example: 'active' },
      ],
      response: {
        status: 200,
        description: 'Paginated list of links with metadata.',
        example: {
          success: true,
          data: [
            {
              id: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04',
              shortCode: 'spring26',
              shortUrl: `https://${domainHost}/spring26`,
              destinationUrl: 'https://example.com/promotions/spring-sale',
              status: 'active',
              clicksCount: 342,
              isPermanent: false,
              externalRef: 'INV-2026-001',
              createdAt: '2026-10-14T10:00:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            totalItems: 1,
            totalPages: 1,
          },
        },
      },
      snippets: {
        curl: `curl -X GET "${baseUrl}/links?page=1&limit=20&status=active" \\
  -H "X-Api-Key: sk_live_your_api_key_here"`,
        node: `// Node.js (fetch)
const query = new URLSearchParams({ page: '1', limit: '20', status: 'active' });
const res = await fetch(\`${baseUrl}/links?\${query}\`, {
  headers: { 'X-Api-Key': process.env.SHORTLY_API_KEY },
});

const data = await res.json();
console.log(\`Found \${data.pagination?.totalItems || 0} links\`);`,
        python: `# Python (requests)
import requests

params = {"page": 1, "limit": 20, "status": "active"}
headers = {"X-Api-Key": "sk_live_..."}

response = requests.get("${baseUrl}/links", params=params, headers=headers)
data = response.json()
print("Links:", len(data.get("data", [])))`,
      },
    },
    {
      id: 'get-link',
      category: 'Links',
      method: 'GET',
      path: '/links/:id',
      title: 'Get Link Details',
      summary: 'Retrieve metadata and live click counters for a specific link by UUID.',
      description: 'Fetches complete metadata for a link including click count, destination URL, tags, permanent protection status, and expiration timer.',
      params: [
        { name: 'id', type: 'UUID', required: true, description: 'Unique identifier of the short link.', example: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04' },
      ],
      response: {
        status: 200,
        description: 'Detailed link item.',
        example: {
          success: true,
          data: {
            id: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04',
            shortCode: 'spring26',
            shortUrl: `https://${domainHost}/spring26`,
            destinationUrl: 'https://example.com/promotions/spring-sale',
            status: 'active',
            clicksCount: 342,
            isPermanent: false,
            createdAt: '2026-10-14T10:00:00.000Z',
          },
        },
      },
      snippets: {
        curl: `curl -X GET "${baseUrl}/links/8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04" \\
  -H "X-Api-Key: sk_live_your_api_key_here"`,
        node: `const linkId = '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04';
const res = await fetch(\`${baseUrl}/links/\${linkId}\`, {
  headers: { 'X-Api-Key': process.env.SHORTLY_API_KEY },
});
const { data } = await res.json();
console.log('Destination:', data.destinationUrl);`,
        python: `import requests

link_id = "8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04"
response = requests.get(
    f"${baseUrl}/links/{link_id}",
    headers={"X-Api-Key": "sk_live_..."}
)
print(response.json())`,
      },
    },
    {
      id: 'update-link',
      category: 'Links',
      method: 'PATCH',
      path: '/links/:id',
      title: 'Update Short Link',
      summary: 'Change destination URL, custom alias, or tags with immediate edge cache invalidation.',
      description: 'Updates properties of an existing link. Changes propagate to Redis edge nodes in sub-10ms. Allows updating destination URL without changing short code on printed QR codes or sent SMS.',
      params: [
        { name: 'id', type: 'UUID', required: true, description: 'Unique identifier of the short link.', example: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04' },
        { name: 'destinationUrl', type: 'string (URL)', required: false, description: 'New redirect destination.', example: 'https://example.com/promotions/updated' },
        { name: 'status', type: 'string ("active" | "archived")', required: false, description: 'Pause or resume link redirection.', example: 'active' },
      ],
      requestBody: {
        contentType: 'application/json',
        schema: 'UpdateLinkDto',
        example: {
          destinationUrl: 'https://example.com/promotions/updated',
          tags: ['promo', 'updated'],
        },
      },
      response: {
        status: 200,
        description: 'Link updated and edge cache refreshed.',
        example: {
          success: true,
          data: {
            id: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04',
            shortCode: 'spring26',
            destinationUrl: 'https://example.com/promotions/updated',
            status: 'active',
            updatedAt: '2026-10-14T11:00:00.000Z',
          },
        },
      },
      snippets: {
        curl: `curl -X PATCH "${baseUrl}/links/8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04" \\
  -H "X-Api-Key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "destinationUrl": "https://example.com/promotions/updated",
    "tags": ["promo", "updated"]
  }'`,
        node: `const linkId = '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04';
const res = await fetch(\`${baseUrl}/links/\${linkId}\`, {
  method: 'PATCH',
  headers: {
    'X-Api-Key': process.env.SHORTLY_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    destinationUrl: 'https://example.com/promotions/updated',
  }),
});
const data = await res.json();
console.log('Updated link:', data);`,
        python: `import requests

link_id = "8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04"
response = requests.patch(
    f"${baseUrl}/links/{link_id}",
    json={"destinationUrl": "https://example.com/promotions/updated"},
    headers={"X-Api-Key": "sk_live_...", "Content-Type": "application/json"}
)
print("Updated:", response.json())`,
      },
    },
    {
      id: 'delete-link',
      category: 'Links',
      method: 'DELETE',
      path: '/links/:id',
      title: 'Archive / Delete Link',
      summary: 'Archive or permanently purge a short link. Permanent links require Admin authorization.',
      description: 'Marks a short link as archived or completely purges it. Permanent links cannot be deleted via standard API calls unless authorized by Super Admin or Admin with explicit confirmation.',
      params: [
        { name: 'id', type: 'UUID', required: true, description: 'Unique identifier of the short link.', example: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04' },
        { name: 'permanent', type: 'boolean', required: false, description: 'Set true to permanently purge the record instead of soft-archiving.', example: 'false' },
      ],
      response: {
        status: 200,
        description: 'Link archived or permanently deleted.',
        example: {
          success: true,
          message: 'Link archived successfully',
        },
      },
      snippets: {
        curl: `curl -X DELETE "${baseUrl}/links/8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04?permanent=false" \\
  -H "X-Api-Key: sk_live_your_api_key_here"`,
        node: `const linkId = '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04';
const res = await fetch(\`${baseUrl}/links/\${linkId}?permanent=false\`, {
  method: 'DELETE',
  headers: { 'X-Api-Key': process.env.SHORTLY_API_KEY },
});
const data = await res.json();
console.log('Result:', data);`,
        python: `import requests

link_id = "8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04"
response = requests.delete(
    f"${baseUrl}/links/{link_id}",
    params={"permanent": "false"},
    headers={"X-Api-Key": "sk_live_..."}
)
print(response.json())`,
      },
    },
    {
      id: 'bulk-links',
      category: 'Bulk & Batch',
      method: 'POST',
      path: '/links/bulk',
      title: 'Bulk Batch Link Generation',
      summary: 'High-throughput ingestion of up to 1,000 links per request for automated campaigns.',
      description: 'Asynchronously or synchronously generates hundreds of branded short links in a single payload. Ideal for ERP SMS batches, payroll alerts, and e-commerce shipping notifications.',
      requestBody: {
        contentType: 'application/json',
        schema: 'BulkCreateLinksDto',
        example: {
          items: [
            { destinationUrl: 'https://example.com/pay/inv-101', slug: 'pay-101', externalRef: 'INV-101' },
            { destinationUrl: 'https://example.com/pay/inv-102', slug: 'pay-102', externalRef: 'INV-102' },
            { destinationUrl: 'https://example.com/pay/inv-103', slug: 'pay-103', externalRef: 'INV-103' },
          ],
        },
      },
      response: {
        status: 201,
        description: 'Batch processed successfully with per-item status.',
        example: {
          success: true,
          data: {
            totalSubmitted: 3,
            totalCreated: 3,
            created: [
              { shortCode: 'pay-101', shortUrl: `https://${domainHost}/pay-101`, externalRef: 'INV-101' },
              { shortCode: 'pay-102', shortUrl: `https://${domainHost}/pay-102`, externalRef: 'INV-102' },
              { shortCode: 'pay-103', shortUrl: `https://${domainHost}/pay-103`, externalRef: 'INV-103' },
            ],
            errors: [],
          },
        },
      },
      snippets: {
        curl: `curl -X POST "${baseUrl}/links/bulk" \\
  -H "X-Api-Key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "destinationUrl": "https://example.com/pay/inv-101", "externalRef": "INV-101" },
      { "destinationUrl": "https://example.com/pay/inv-102", "externalRef": "INV-102" }
    ]
  }'`,
        node: `// Bulk Link Creation in Node.js
const res = await fetch('${baseUrl}/links/bulk', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.SHORTLY_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    items: [
      { destinationUrl: 'https://example.com/receipt/1', externalRef: 'REC-001' },
      { destinationUrl: 'https://example.com/receipt/2', externalRef: 'REC-002' },
    ],
  }),
});

const result = await res.json();
console.log(\`Created \${result.data?.totalCreated} links\`);`,
        python: `# Bulk Link Creation in Python
import requests

items = [
    {"destinationUrl": "https://example.com/shipment/1", "externalRef": "TRK-001"},
    {"destinationUrl": "https://example.com/shipment/2", "externalRef": "TRK-002"},
]

response = requests.post(
    "${baseUrl}/links/bulk",
    json={"items": items},
    headers={"X-Api-Key": "sk_live_..."}
)
print("Batch Result:", response.json())`,
      },
    },
    {
      id: 'batch-action',
      category: 'Bulk & Batch',
      method: 'POST',
      path: '/links/batch-action',
      title: 'Batch Multi-Link Actions',
      summary: 'Archive, restore, or delete multiple links at once using link UUID arrays.',
      description: 'Executes bulk state transitions across multiple links in a single atomic transaction. Permanent links are safely preserved unless explicitly authorized by an administrator.',
      requestBody: {
        contentType: 'application/json',
        schema: 'BatchActionDto',
        example: {
          action: 'archive',
          linkIds: ['8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04', '3b1e9c22-7f41-4a11-8812-5e4a8b1c2d01'],
        },
      },
      response: {
        status: 200,
        description: 'Batch action completed.',
        example: {
          success: true,
          data: {
            affectedCount: 2,
            action: 'archive',
          },
        },
      },
      snippets: {
        curl: `curl -X POST "${baseUrl}/links/batch-action" \\
  -H "X-Api-Key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "archive",
    "linkIds": ["8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04"]
  }'`,
        node: `const res = await fetch('${baseUrl}/links/batch-action', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.SHORTLY_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    action: 'archive',
    linkIds: ['8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04'],
  }),
});
console.log(await res.json());`,
        python: `import requests

payload = {
    "action": "archive",
    "linkIds": ["8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04"]
}
response = requests.post(
    "${baseUrl}/links/batch-action",
    json=payload,
    headers={"X-Api-Key": "sk_live_..."}
)
print(response.json())`,
      },
    },
    {
      id: 'qr-code',
      category: 'QR Studio',
      method: 'GET',
      path: '/links/:id/qr',
      title: 'Dynamic QR Code Generation',
      summary: 'Generate high-resolution vector SVG or raster PNG QR codes for print and packaging.',
      description: 'Generates dynamic QR codes encoding the branded short URL. Supports custom pixel sizing (64 to 2048px), vector SVG output, margin control, and foreground/background hex colors.',
      params: [
        { name: 'id', type: 'UUID', required: true, description: 'Short link UUID.', example: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04' },
        { name: 'format', type: 'string ("png" | "svg")', required: false, description: 'Output format (default "png").', example: 'png' },
        { name: 'size', type: 'integer (64-2048)', required: false, description: 'Image width and height in pixels (default 512).', example: '512' },
        { name: 'margin', type: 'integer (0-10)', required: false, description: 'Quiet zone margin blocks (default 2).', example: '2' },
      ],
      response: {
        status: 200,
        description: 'Binary image stream (image/png or image/svg+xml).',
        example: {
          binary: '<PNG Image Data or SVG XML String>',
        },
      },
      snippets: {
        curl: `curl -X GET "${baseUrl}/links/8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04/qr?size=512&format=png" \\
  -H "X-Api-Key: sk_live_your_api_key_here" \\
  --output qrcode.png`,
        node: `import fs from 'node:fs';

const linkId = '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04';
const res = await fetch(\`${baseUrl}/links/\${linkId}/qr?size=512&format=png\`, {
  headers: { 'X-Api-Key': process.env.SHORTLY_API_KEY },
});

const buffer = Buffer.from(await res.arrayBuffer());
fs.writeFileSync('qrcode.png', buffer);
console.log('Saved QR code image');`,
        python: `import requests

link_id = "8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04"
response = requests.get(
    f"${baseUrl}/links/{link_id}/qr",
    params={"size": 512, "format": "png"},
    headers={"X-Api-Key": "sk_live_..."}
)

with open("qrcode.png", "wb") as f:
    f.write(response.content)
print("QR Code downloaded as qrcode.png")`,
      },
    },
    {
      id: 'analytics-summary',
      category: 'Analytics',
      method: 'GET',
      path: '/analytics/summary',
      title: 'Traffic Analytics Summary',
      summary: 'Fetch aggregate click counts, unique visitors, devices, and top referrers.',
      description: 'Returns real-time aggregated metrics with privacy-preserving hashing (DPDP Act 2023 compliant). Filter by link ID or organization-wide time windows.',
      params: [
        { name: 'range', type: 'string ("24h" | "7d" | "30d" | "90d")', required: false, description: 'Time horizon for metrics aggregation.', example: '30d' },
        { name: 'linkId', type: 'UUID', required: false, description: 'Optional specific link filter.', example: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04' },
      ],
      response: {
        status: 200,
        description: 'Aggregate traffic analytics object.',
        example: {
          success: true,
          data: {
            totalClicks: 14850,
            uniqueVisitors: 9210,
            topReferrers: [
              { name: 'SMS / Direct', clicks: 8200 },
              { name: 'WhatsApp', clicks: 3120 },
              { name: 'Google', clicks: 1450 },
            ],
            deviceBreakdown: {
              mobile: '78%',
              desktop: '19%',
              tablet: '3%',
            },
          },
        },
      },
      snippets: {
        curl: `curl -X GET "${baseUrl}/analytics/summary?range=30d" \\
  -H "X-Api-Key: sk_live_your_api_key_here"`,
        node: `const res = await fetch('${baseUrl}/analytics/summary?range=30d', {
  headers: { 'X-Api-Key': process.env.SHORTLY_API_KEY },
});
const data = await res.json();
console.log('Total clicks:', data.data?.totalClicks);`,
        python: `import requests

response = requests.get(
    "${baseUrl}/analytics/summary",
    params={"range": "30d"},
    headers={"X-Api-Key": "sk_live_..."}
)
print("Metrics:", response.json())`,
      },
    },
    {
      id: 'post-outcome',
      category: 'Outcomes',
      method: 'POST',
      path: '/outcomes',
      title: 'Log Conversion Outcome',
      summary: 'Closed-loop revenue and goal reconciliation webhook for payment gateways and ERPs.',
      description: 'Attributes downstream business outcomes (such as Razorpay/Stripe payments, fee collections, or signups) to the original short link via externalRef or linkId.',
      requestBody: {
        contentType: 'application/json',
        schema: 'RecordOutcomeDto',
        example: {
          externalRef: 'INV-2026-001',
          eventType: 'payment_success',
          revenueAmount: 1499.00,
          currency: 'INR',
          transactionId: 'txn_pay_908124',
        },
      },
      response: {
        status: 201,
        description: 'Outcome reconciled with click journey.',
        example: {
          success: true,
          data: {
            outcomeId: 'out_55a29b-71cd-408a',
            matchedLinkId: '8f7d6a42-9e31-4c12-b912-7a5e8c1b3d04',
            revenueAmount: 1499.00,
            currency: 'INR',
            status: 'reconciled',
            recordedAt: '2026-10-14T11:15:00.000Z',
          },
        },
      },
      snippets: {
        curl: `curl -X POST "${baseUrl}/outcomes" \\
  -H "X-Api-Key: sk_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalRef": "INV-2026-001",
    "eventType": "payment_success",
    "revenueAmount": 1499.00,
    "currency": "INR",
    "transactionId": "txn_pay_908124"
  }'`,
        node: `// Reconcile payment callback in Node.js
const res = await fetch('${baseUrl}/outcomes', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.SHORTLY_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    externalRef: 'INV-2026-001',
    eventType: 'payment_success',
    revenueAmount: 1499.00,
    currency: 'INR',
    transactionId: 'txn_pay_908124',
  }),
});

const outcome = await res.json();
console.log('Outcome status:', outcome.data?.status);`,
        python: `# Reconcile payment in Python
import requests

payload = {
    "externalRef": "INV-2026-001",
    "eventType": "payment_success",
    "revenueAmount": 1499.00,
    "currency": "INR",
    "transactionId": "txn_pay_908124",
}

response = requests.post(
    "${baseUrl}/outcomes",
    json=payload,
    headers={"X-Api-Key": "sk_live_..."}
)
print("Attribution:", response.json())`,
      },
    },
    {
      id: 'health-check',
      category: 'System',
      method: 'GET',
      path: '/health',
      title: 'Service Health Status',
      summary: 'Public real-time health check for API gateway, PostgreSQL database, and Redis cache.',
      description: 'Used by uptime monitors, load balancers, and container orchestrators. Requires no authentication.',
      response: {
        status: 200,
        description: 'System operational status.',
        example: {
          status: 'ok',
          timestamp: '2026-10-14T12:00:00.000Z',
          services: {
            database: 'healthy',
            redis: 'healthy',
          },
        },
      },
      snippets: {
        curl: `curl -X GET "${baseUrl}/health"`,
        node: `const res = await fetch('${baseUrl}/health');
const health = await res.json();
console.log('System Status:', health.status);`,
        python: `import requests
res = requests.get("${baseUrl}/health")
print("Health:", res.json())`,
      },
    },
  ], [baseUrl, domainHost]);

  // Error Definitions
  const errorCatalog = [
    {
      status: 400,
      code: 'VALIDATION_ERROR',
      title: 'Bad Request / Validation Error',
      description: 'The request body, path parameter, or query string failed schema validation.',
      cause: 'Invalid destination URL format, slug containing illegal characters, or missing required fields.',
      json: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'destinationUrl must be a valid HTTP or HTTPS address',
        },
      },
    },
    {
      status: 401,
      code: 'UNAUTHORIZED',
      title: 'Unauthorized',
      description: 'Missing or malformed authentication credentials.',
      cause: 'No X-Api-Key header provided, key does not exist, or Bearer token is invalid.',
      json: {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please provide a Bearer token or X-API-Key header.',
        },
      },
    },
    {
      status: 403,
      code: 'FORBIDDEN',
      title: 'Forbidden',
      description: 'Authenticated client lacks authorization for the requested resource.',
      cause: 'API Key lacks necessary scope (e.g. attempting to delete without admin scope), key revoked, or tenant mismatch.',
      json: {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Your API key does not have the required scope for this operation',
        },
      },
    },
    {
      status: 404,
      code: 'NOT_FOUND',
      title: 'Not Found',
      description: 'The target short link, tenant, or resource ID was not found.',
      cause: 'Link UUID does not exist or belongs to another organization.',
      json: {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Link not found',
        },
      },
    },
    {
      status: 409,
      code: 'ALIAS_CONFLICT',
      title: 'Conflict / Slug Taken',
      description: 'The requested custom alias is already occupied on this domain.',
      cause: 'Another active link in your organization is already assigned this slug.',
      json: {
        success: false,
        error: {
          code: 'ALIAS_CONFLICT',
          message: 'The requested custom slug is already in use on this domain',
        },
      },
    },
    {
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      title: 'Too Many Requests / Rate Limited',
      description: 'Your API key has exceeded its per-minute rate limit window.',
      cause: 'Client sent more requests than allowed by the key RPM tier within a rolling 60-second window.',
      json: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit of 60 requests per minute exceeded. Try again in 24 seconds.',
        },
      },
    },
    {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      title: 'Internal Server Error',
      description: 'An unexpected internal fault occurred in the backend service.',
      cause: 'Database timeout, Redis cluster unreachable, or unhandled exception.',
      json: {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal error occurred while processing your request',
        },
      },
    },
  ];

  // Navigation Items List (Ordered for Prev / Next calculation)
  const allNavItems = useMemo(() => [
    { id: 'intro', title: 'Base URL & Protocols', category: 'Overview & Standards', icon: Globe },
    { id: 'auth', title: 'Authentication', category: 'Overview & Standards', icon: Key },
    { id: 'ratelimits', title: 'Rate Limits & Headers', category: 'Overview & Standards', icon: Clock },
    { id: 'errors', title: 'Error Handling', category: 'Overview & Standards', icon: AlertTriangle },
    ...endpoints.map((ep) => ({
      id: ep.id,
      title: ep.title,
      category: ep.category,
      method: ep.method,
      icon: Code2,
    })),
  ], [endpoints]);

  // Filtered Navigation based on search
  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return allNavItems;
    const q = searchQuery.toLowerCase();
    return allNavItems.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item as any).method?.toLowerCase().includes(q)
    );
  }, [allNavItems, searchQuery]);

  // Current Item Index & Adjacent Items for Pagination
  const currentIndex = allNavItems.findIndex((item) => item.id === activeSection);
  const prevItem = currentIndex > 0 ? allNavItems[currentIndex - 1] : null;
  const nextItem = currentIndex >= 0 && currentIndex < allNavItems.length - 1 ? allNavItems[currentIndex + 1] : null;

  // Selected Endpoint Object (if activeSection is an endpoint)
  const currentEndpoint = endpoints.find((ep) => ep.id === activeSection);

  return (
    <div className="space-y-4 w-full text-slate-800 pb-16">
      {/* 1. Header Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Code2 className="w-4 h-4" />
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Developer API Reference &amp; SDKs
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              v1.0 Stable
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Clean, modular documentation for short links, bulk CSV batching, QR codes, analytics, and revenue attribution.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {onNavigateToApiKeys && (
            <button
              onClick={onNavigateToApiKeys}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-blue-600" />
              Manage API Keys
            </button>
          )}

          {/* Global Framework Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
            {(['curl', 'node', 'python'] as Framework[]).map((fw) => (
              <button
                key={fw}
                onClick={() => setSelectedFramework(fw)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                  selectedFramework === fw
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {fw === 'curl' ? 'cURL' : fw === 'node' ? 'Node.js' : 'Python'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Focused Modular Documentation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Navigation Sidebar (3 cols) */}
        <aside className="lg:col-span-3 lg:sticky lg:top-4 space-y-3">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>

          {/* Navigation Panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto">
            {/* Overview & Standards Group */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Overview &amp; Standards
              </div>
              <div className="space-y-0.5 mt-1">
                {[
                  { id: 'intro', label: 'Base URL & Protocols', icon: Globe },
                  { id: 'auth', label: 'Authentication', icon: Key },
                  { id: 'ratelimits', label: 'Rate Limits & Headers', icon: Clock },
                  { id: 'errors', label: 'Error Handling', icon: AlertTriangle },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSection(item.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Endpoints Groups */}
            <div className="pt-2 border-t border-slate-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>API Endpoints</span>
                <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full font-bold">
                  {endpoints.length}
                </span>
              </div>
              <div className="space-y-0.5 mt-1">
                {endpoints.map((ep) => {
                  const isActive = activeSection === ep.id;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => handleSelectSection(ep.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : ep.method === 'GET'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ep.method === 'POST'
                              ? 'bg-blue-100 text-blue-800'
                              : ep.method === 'PATCH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {ep.method}
                        </span>
                        <span className="truncate text-[11px]">{ep.title}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Active-Item View Container (9 cols) */}
        <main className="lg:col-span-9 space-y-5">
          {/* Active View: SECTION 1: Base URL & Protocol */}
          {activeSection === 'intro' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Overview &amp; Standards</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-900">Base URL &amp; Protocols</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-900">Base URL &amp; Network Protocols</h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">TLS 1.3 / HTTPS</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Shortly exposes high-throughput RESTful endpoints accepting and returning <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 text-[11px]">application/json</code>. All network traffic must occur over encrypted HTTPS. Plaintext HTTP requests are automatically rejected.
                </p>

                <div className="bg-[#0d1527] rounded-lg p-3 text-white flex items-center justify-between font-mono text-xs shadow-inner">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 select-none">PRODUCTION_BASE_URL:</span>
                    <span className="text-emerald-400 font-semibold">{baseUrl}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(baseUrl, 'copy-base-url')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition cursor-pointer shrink-0"
                  >
                    {copiedId === 'copy-base-url' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-semibold text-slate-800">Edge Redirection</div>
                    <p className="text-[11px] text-slate-500">
                      Sub-2ms link redirection distributed globally across Redis edge nodes.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-semibold text-slate-800">Character Encoding</div>
                    <p className="text-[11px] text-slate-500">
                      Full UTF-8 support with automated TRAI 160-character GSM-7 SMS optimizations.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="font-semibold text-slate-800">Idempotency</div>
                    <p className="text-[11px] text-slate-500">
                      Safe retries on POST endpoints via automatic unique constraint reconciliation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active View: SECTION 2: Authentication */}
          {activeSection === 'auth' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Overview &amp; Standards</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-900">API Key Authentication</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold text-slate-900">API Key Authentication Reference</h2>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    X-Api-Key Header
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Authenticate API calls by including your secret API key in the <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 text-[11px]">X-Api-Key</code> request header. Alternatively, standard HTTP Bearer token syntax (<code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 text-[11px]">Authorization: Bearer sk_live_...</code>) is accepted.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Header Authentication (Recommended)</span>
                    </div>
                    <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-700 select-all">
                      X-Api-Key: sk_live_7c8d9e0f1a2b...
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard for microservices, backend webhooks, cron workers, and ERP integration pipelines.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Bearer Token Alternative</span>
                    </div>
                    <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-700 select-all">
                      Authorization: Bearer sk_live_7c8d9e0f1a2b...
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Compatible with API gateway proxies, Zapier, Postman, and standard HTTP client interceptors.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Security Rule:</span> API keys are <span className="underline font-semibold">never</span> accepted via query parameters (e.g. <code className="font-mono text-[11px]">?api_key=...</code>) to protect tokens from being logged in upstream browser histories, CDN access logs, or proxy request logs.
                  </div>
                </div>

                {/* Framework Snippet Box */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Sample Authenticated Request:</span>
                    <span className="text-[11px] text-slate-400 font-mono">Status Check</span>
                  </div>

                  <div className="bg-[#0d1527] rounded-lg border border-slate-800 overflow-hidden shadow-sm">
                    <div className="bg-[#162032] px-3 py-1.5 flex items-center justify-between border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-mono text-[11px] text-slate-300">
                          {selectedFramework === 'curl' ? 'cURL' : selectedFramework === 'node' ? 'Node.js' : 'Python'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const snippet = selectedFramework === 'curl'
                            ? `curl -X GET "${baseUrl}/links?limit=5" \\\n  -H "X-Api-Key: sk_live_your_key_here"`
                            : selectedFramework === 'node'
                            ? `const res = await fetch('${baseUrl}/links?limit=5', {\n  headers: { 'X-Api-Key': 'sk_live_your_key_here' }\n});\nconst data = await res.json();`
                            : `import requests\nres = requests.get('${baseUrl}/links', params={'limit': 5}, headers={'X-Api-Key': 'sk_live_your_key_here'})\nprint(res.json())`;
                          handleCopy(snippet, 'auth-snippet');
                        }}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {copiedId === 'auth-snippet' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed">
                      {selectedFramework === 'curl' && `curl -X GET "${baseUrl}/links?limit=5" \\
  -H "X-Api-Key: sk_live_your_key_here"`}
                      {selectedFramework === 'node' && `const res = await fetch('${baseUrl}/links?limit=5', {
  headers: {
    'X-Api-Key': process.env.SHORTLY_API_KEY,
  },
});
const data = await res.json();`}
                      {selectedFramework === 'python' && `import os
import requests

headers = {"X-Api-Key": os.getenv("SHORTLY_API_KEY", "sk_live_...")}
response = requests.get("${baseUrl}/links", params={"limit": 5}, headers=headers)
data = response.json()`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active View: SECTION 3: Rate Limits & Headers */}
          {activeSection === 'ratelimits' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Overview &amp; Standards</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-900">Rate Limits &amp; Response Headers</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-900">Rate Limits &amp; Telemetry Headers</h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">60-Second Sliding Window</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Shortly applies token-bucket rate limiting backed by distributed Redis memory clusters. Every HTTP API response includes standard telemetry headers allowing clients to monitor remaining capacity in real-time.
                </p>

                {/* Headers Table */}
                <div className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Header Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">X-RateLimit-Limit</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">Integer</td>
                        <td className="py-2.5 px-3 text-slate-600">The maximum number of allowed requests in the rolling 60-second window.</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">60</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">X-RateLimit-Remaining</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">Integer</td>
                        <td className="py-2.5 px-3 text-slate-600">Remaining requests available before hitting HTTP 429 throttling.</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">59</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">X-RateLimit-Reset</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">Unix Timestamp</td>
                        <td className="py-2.5 px-3 text-slate-600">UTC epoch timestamp (in seconds) when the current rate limit window resets.</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">1791894000</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-700">Retry-After</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">Integer (Sec)</td>
                        <td className="py-2.5 px-3 text-slate-600">Sent on HTTP 429; the exact number of seconds client must sleep before retrying.</td>
                        <td className="py-2.5 px-3 font-mono text-rose-600 font-bold">18</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Exponential Backoff Code */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-slate-700">
                    Recommended Handling: Exponential Backoff &amp; Sleep Loop
                  </div>
                  <div className="bg-[#0d1527] rounded-lg border border-slate-800 overflow-hidden shadow-sm">
                    <div className="bg-[#162032] px-3 py-1.5 flex items-center justify-between border-b border-slate-800 text-xs">
                      <span className="font-mono text-[11px] text-slate-300">
                        {selectedFramework === 'curl' ? 'cURL Header Inspection' : selectedFramework === 'node' ? 'Node.js Backoff Middleware' : 'Python Retry Loop'}
                      </span>
                      <button
                        onClick={() => {
                          const snippet = selectedFramework === 'curl'
                            ? `curl -i -X GET "${baseUrl}/links" -H "X-Api-Key: sk_live_..."`
                            : selectedFramework === 'node'
                            ? `async function fetchWithBackoff(url, options = {}, retries = 3) {\n  const res = await fetch(url, options);\n  if (res.status === 429 && retries > 0) {\n    const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);\n    console.warn(\`Rate limited. Sleeping for \${retryAfter}s...\`);\n    await new Promise(r => setTimeout(r, retryAfter * 1000));\n    return fetchWithBackoff(url, options, retries - 1);\n  }\n  return res;\n}`
                            : `import time\nimport requests\n\ndef fetch_with_retry(url, headers, retries=3):\n    response = requests.get(url, headers=headers)\n    if response.status_code == 429 and retries > 0:\n        retry_after = int(response.headers.get("Retry-After", 2))\n        print(f"Rate limited. Backing off for {retry_after} seconds...")\n        time.sleep(retry_after)\n        return fetch_with_retry(url, headers, retries - 1)\n    return response`;
                          handleCopy(snippet, 'backoff-snippet');
                        }}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {copiedId === 'backoff-snippet' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed">
                      {selectedFramework === 'curl' && `# Use -i flag to inspect live rate-limit headers
curl -i -X GET "${baseUrl}/links" \\
  -H "X-Api-Key: sk_live_your_key_here"`}
                      {selectedFramework === 'node' && `async function fetchWithBackoff(url, options = {}, retries = 3) {
  const res = await fetch(url, options);

  // Inspect rate limit remaining
  const remaining = res.headers.get('x-ratelimit-remaining');
  console.log(\`Remaining quota: \${remaining} req/min\`);

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);
    console.warn(\`Rate limit reached. Sleeping for \${retryAfter}s...\`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetchWithBackoff(url, options, retries - 1);
  }

  return res;
}`}
                      {selectedFramework === 'python' && `import time
import requests

def request_with_backoff(url, headers, retries=3):
    response = requests.get(url, headers=headers)
    remaining = response.headers.get("X-RateLimit-Remaining")
    print(f"Remaining quota: {remaining}")

    if response.status_code == 429 and retries > 0:
        retry_after = int(response.headers.get("Retry-After", 2))
        print(f"Rate limit exceeded. Waiting {retry_after}s...")
        time.sleep(retry_after)
        return request_with_backoff(url, headers, retries - 1)

    return response`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active View: SECTION 4: Error Handling */}
          {activeSection === 'errors' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Overview &amp; Standards</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-900">Standard Error Responses</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <h2 className="text-sm font-bold text-slate-900">Error Handling &amp; Status Code Matrix</h2>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">RFC 7807 Standard</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  All error responses return a standardized JSON envelope with <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 text-[11px]">success: false</code> and an <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-800 text-[11px]">error</code> object containing a canonical machine-readable <code className="font-mono text-[11px]">code</code> and a human-readable <code className="font-mono text-[11px]">message</code>.
                </p>

                {/* Interactive Error Code Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
                  {errorCatalog.map((err) => (
                    <button
                      key={err.code}
                      onClick={() => setSelectedErrorTab(err.status.toString())}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                        selectedErrorTab === err.status.toString()
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 bg-slate-100 hover:bg-slate-200/70'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          err.status >= 500
                            ? 'bg-red-400'
                            : err.status === 429
                            ? 'bg-amber-400'
                            : err.status === 401 || err.status === 403
                            ? 'bg-rose-400'
                            : 'bg-blue-400'
                        }`}
                      />
                      <span>HTTP {err.status}</span>
                      <span className="text-[10px] font-mono opacity-80">({err.code})</span>
                    </button>
                  ))}
                </div>

                {/* Error Detail Card */}
                {(() => {
                  const activeErr = errorCatalog.find((e) => e.status.toString() === selectedErrorTab) || errorCatalog[0];
                  return (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                              activeErr.status >= 500
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : activeErr.status === 429
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            HTTP {activeErr.status} {activeErr.code}
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">{activeErr.title}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600">{activeErr.description}</p>
                      <div className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">Common Triggers:</span> {activeErr.cause}
                      </div>

                      <div className="bg-[#0d1527] rounded-lg p-3 text-slate-200 font-mono text-xs overflow-x-auto relative shadow-inner">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 select-none font-sans font-bold">
                          Response Payload (JSON):
                        </div>
                        <pre>{JSON.stringify(activeErr.json, null, 2)}</pre>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Active View: Specific Endpoint */}
          {currentEndpoint && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>{currentEndpoint.category}</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="font-semibold text-slate-900">{currentEndpoint.title}</span>
              </div>

              {/* Endpoint Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                {/* Header Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-xs uppercase ${
                        currentEndpoint.method === 'GET'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : currentEndpoint.method === 'POST'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : currentEndpoint.method === 'PATCH'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}
                    >
                      {currentEndpoint.method}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {currentEndpoint.path}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">• {currentEndpoint.title}</h2>
                  </div>

                  {/* Local Framework Switcher */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                    {(['curl', 'node', 'python'] as Framework[]).map((fw) => (
                      <button
                        key={fw}
                        onClick={() => setSelectedFramework(fw)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                          selectedFramework === fw
                            ? 'bg-white text-blue-600 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {fw === 'curl' ? 'cURL' : fw === 'node' ? 'Node.js' : 'Python'}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{currentEndpoint.description}</p>

                {/* Parameters Reference */}
                {currentEndpoint.params && currentEndpoint.params.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-semibold text-slate-700">Request Parameters:</div>
                    <div className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Field</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Requirement</th>
                            <th className="py-2.5 px-3">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {currentEndpoint.params.map((param) => (
                            <tr key={param.name} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{param.name}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{param.type}</td>
                              <td className="py-2.5 px-3">
                                {param.required ? (
                                  <span className="text-rose-600 font-bold">Required</span>
                                ) : (
                                  <span className="text-slate-400">Optional</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Code Snippet Box */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Code Snippet ({selectedFramework.toUpperCase()}):</span>
                    <span className="text-[11px] text-slate-400 font-mono">Ready to Execute</span>
                  </div>

                  <div className="bg-[#0d1527] rounded-lg border border-slate-800 overflow-hidden shadow-sm">
                    <div className="bg-[#162032] px-3 py-1.5 flex items-center justify-between border-b border-slate-800 text-xs">
                      <span className="font-mono text-[11px] text-slate-300">
                        {selectedFramework === 'curl' ? 'Terminal (cURL)' : selectedFramework === 'node' ? 'Node.js (Fetch)' : 'Python 3 (Requests)'}
                      </span>
                      <button
                        onClick={() => handleCopy(currentEndpoint.snippets[selectedFramework], `snip-${currentEndpoint.id}`)}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {copiedId === `snip-${currentEndpoint.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Snippet</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3.5 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed">
                      {currentEndpoint.snippets[selectedFramework]}
                    </pre>
                  </div>
                </div>

                {/* Expected Response Box */}
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Expected Response</span>
                      <span className="font-mono text-[11px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                        HTTP {currentEndpoint.response.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">{currentEndpoint.response.description}</span>
                  </div>

                  <div className="bg-[#0d1527] rounded-lg p-3 text-slate-200 font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify(currentEndpoint.response.example, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Bottom Previous / Next Pagination Footer */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-200/80">
            {prevItem ? (
              <button
                onClick={() => handleSelectSection(prevItem.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition cursor-pointer text-left"
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Previous</div>
                  <div className="truncate max-w-[180px]">{prevItem.title}</div>
                </div>
              </button>
            ) : <div />}

            {nextItem ? (
              <button
                onClick={() => handleSelectSection(nextItem.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition cursor-pointer text-right ml-auto"
              >
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Next</div>
                  <div className="truncate max-w-[180px]">{nextItem.title}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ) : <div />}
          </div>
        </main>
      </div>
    </div>
  );
};
