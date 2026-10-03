import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const CMS_API_KEY = process.env.CMS_API_KEY || process.env.NEXT_PUBLIC_CMS_API_KEY || '';

async function handleRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const targetPath = pathParts.join('/');
  const { searchParams } = new URL(req.url);
  const queryString = searchParams.toString();
  
  const targetUrl = `${BACKEND_URL}/api/v1/${targetPath}${queryString ? `?${queryString}` : ''}`;
  
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (CMS_API_KEY) {
    headers.set('x-api-key', CMS_API_KEY);
  }
  
  const options: RequestInit = {
    method: req.method,
    headers,
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const bodyText = await req.text();
    if (bodyText) {
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
