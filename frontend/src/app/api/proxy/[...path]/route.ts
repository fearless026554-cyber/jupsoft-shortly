import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

async function handleRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const targetPath = pathParts.join('/');
  const { searchParams } = new URL(req.url);
  const queryString = searchParams.toString();
  
  const targetUrl = `${BACKEND_URL}/api/v1/${targetPath}${queryString ? `?${queryString}` : ''}`;
  
  const headers = new Headers();

  // Forward client identity & authorization headers
  const authHeader = req.headers.get('authorization');
  const clientApiKey = req.headers.get('x-api-key');
  const idempotencyKey = req.headers.get('idempotency-key');
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');

  if (authHeader) {
    headers.set('authorization', authHeader);
  } else if (clientApiKey) {
    headers.set('x-api-key', clientApiKey);
  }

  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
  }

  if (idempotencyKey) {
    headers.set('idempotency-key', idempotencyKey);
  }
  
  const options: RequestInit = {
    method: req.method,
    headers,
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const bodyText = await req.text();
    if (bodyText) {
      headers.set('Content-Type', 'application/json');
      options.body = bodyText;
    }
  }

  try {
    const response = await fetch(targetUrl, options);
    
    // We construct a new Response object to stream the backend response
    // back to the client directly.
    const resHeaders = new Headers(response.headers);
    
    return new Response(response.body, {
      status: response.status,
      headers: resHeaders
    });
  } catch (error) {
    console.error('Proxy Error:', error);
    return new Response(JSON.stringify({ success: false, error: { message: 'Internal Server Error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
