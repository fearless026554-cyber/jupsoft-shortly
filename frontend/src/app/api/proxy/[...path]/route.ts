import { NextRequest } from 'next/server';

// Ensure IPv4 is used instead of IPv6 'localhost' to prevent connection timeouts/refusals
const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace('localhost', '127.0.0.1');

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length', // Delete content-length so Next.js stream chunking is accurate
];

async function handleRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathParts = resolvedParams?.path
    ? Array.isArray(resolvedParams.path)
      ? resolvedParams.path
      : [resolvedParams.path]
    : [];

  // Normalize path: clean up leading/trailing slashes and strip duplicate api/v1 or api prefixes
  let cleanPath = pathParts.join('/').replace(/^\/+|\/+$/g, '');
  if (cleanPath.startsWith('api/v1/')) {
    cleanPath = cleanPath.slice(7);
  } else if (cleanPath.startsWith('api/')) {
    cleanPath = cleanPath.slice(4);
  } else if (cleanPath.startsWith('v1/')) {
    cleanPath = cleanPath.slice(3);
  }

  // Preserve the exact raw query string untouched from req.nextUrl
  const queryString = req.nextUrl.search || '';
  const targetUrl = `${BACKEND_URL}/api/v1/${cleanPath}${queryString}`;

  const headers = new Headers();

  // Forward client identity & authorization headers
  const authHeader = req.headers.get('authorization');
  const clientApiKey = req.headers.get('x-api-key');
  const idempotencyKey = req.headers.get('idempotency-key');
  const clientIp =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip');
  const cookieHeader = req.headers.get('cookie');

  if (authHeader) {
    headers.set('authorization', authHeader);
  } else if (clientApiKey) {
    headers.set('x-api-key', clientApiKey);
  } else if (cookieHeader) {
    // Fallback: extract jlmp_auth_token cookie if Authorization header wasn't set
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );
    if (cookies['jlmp_auth_token']) {
      headers.set('authorization', `Bearer ${cookies['jlmp_auth_token']}`);
    }
  }

  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
  }

  if (idempotencyKey) {
    headers.set('idempotency-key', idempotencyKey);
  }

  const acceptHeader = req.headers.get('accept');
  if (acceptHeader) {
    headers.set('accept', acceptHeader);
  }

  const userAgent = req.headers.get('user-agent');
  if (userAgent) {
    headers.set('user-agent', userAgent);
  }

  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  headers.set('x-forwarded-proto', forwardedProto);

  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost) {
    headers.set('x-forwarded-host', forwardedHost);
  }

  const options: RequestInit = {
    method: req.method,
    headers,
    signal: req.signal, // Propagate client abort signal (B11)
  };

  // Safe body & Content-Type handling:
  // ONLY set Content-Type if a non-empty request body is actually provided.
  // Fastify throws FST_ERR_CTP_EMPTY_JSON_BODY (400) if Content-Type: application/json
  // is passed with an empty body (e.g. DELETE requests, logout, clone, etc.)!
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const bodyText = await req.text();
    if (bodyText && bodyText.trim().length > 0) {
      options.body = bodyText;
      const contentType = req.headers.get('content-type');
      headers.set('content-type', contentType || 'application/json');
    } else {
      headers.delete('content-type');
    }
  } else {
    // Strictly strip Content-Type on GET and HEAD
    headers.delete('content-type');
  }

  try {
    const response = await fetch(targetUrl, options);

    // Construct response streaming back to client. Strip hop-by-hop headers.
    const resHeaders = new Headers(response.headers);
    for (const h of HOP_BY_HOP_HEADERS) {
      resHeaders.delete(h);
    }

    // HTTP 204 No Content and 304 Not Modified must not return a body
    if (response.status === 204 || response.status === 304) {
      return new Response(null, {
        status: response.status,
        headers: resHeaders,
      });
    }

    // Read full buffer to ensure exact byte length and prevent compression/stream mismatches
    const bodyBuffer = await response.arrayBuffer();
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length');
    resHeaders.set('content-length', String(bodyBuffer.byteLength));

    return new Response(bodyBuffer, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError' || req.signal?.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error(`Proxy Error [${req.method} ${targetUrl}]:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'PROXY_BACKEND_UNAVAILABLE',
          message: error?.message || 'Failed to communicate with backend service',
        },
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
  handleRequest as PATCH,
  handleRequest as DELETE,
  handleRequest as OPTIONS,
};
