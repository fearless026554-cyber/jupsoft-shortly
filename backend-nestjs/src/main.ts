import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

import { env } from './config/env.js';

import { ErrorHandlerFilter } from './common/filters/error-handler.filter.js';
import { GeoUAMiddleware } from './common/middleware/geo-ua.middleware.js';

import * as http from 'node:http';
import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import helmet from '@fastify/helmet';

function startLocalDomainGateways(backendPort: number, frontendPort = Number(process.env.FRONTEND_PORT || 5001)) {
  const FRONTEND_PREFIXES = [
    '/_next',
    '/api/proxy',
    '/dashboard',
    '/overview',
    '/links',
    '/bulk',
    '/outcomes',
    '/qr',
    '/reports',
    '/analytics',
    '/tenants',
    '/users',
    '/domains',
    '/abuse',
    '/apikeys',
    '/docs',
    '/apidocs',
    '/profile',
    '/settings',
    '/help',
    '/login',
    '/landing',
    '/icon.png',
    '/favicon.ico',
    '/jupsoft-logo.png',
  ];

  const handleGatewayRequest = (proto: 'http' | 'https') => (clientReq: http.IncomingMessage, clientRes: http.ServerResponse) => {
    const rawUrl = clientReq.url || '/';
    const pathOnly = rawUrl.split('?')[0];

    const isFrontendRoute =
      pathOnly === '/' ||
      FRONTEND_PREFIXES.some(
        (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`) || pathOnly.startsWith(`${prefix}?`)
      );

    const targetPort = isFrontendRoute ? frontendPort : backendPort;

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: targetPort,
        path: rawUrl,
        method: clientReq.method,
        headers: {
          ...clientReq.headers,
          'x-forwarded-proto': proto,
          'x-forwarded-host': clientReq.headers.host || '',
          'x-forwarded-for': clientReq.socket.remoteAddress || '127.0.0.1',
        },
      },
      (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      clientRes.end(`Local Gateway Error: ${err.message}`);
    });

    clientReq.pipe(proxyReq, { end: true });
  };

  const httpGateway = http.createServer(handleGatewayRequest('http'));
  httpGateway.on('error', (err: any) => {
    console.warn(`[Port 80 Gateway] Could not bind port 80 (${err.code || err.message})`);
  });
  httpGateway.listen(80, '0.0.0.0', () => {
    console.log(`[Port 80 HTTP Gateway] Hosting custom domains on http://0.0.0.0:80 -> Backend(:${backendPort}) & Frontend(:${frontendPort})`);
  });

  const certPath = path.resolve(process.cwd(), 'certs', 'server.crt');
  const keyPath = path.resolve(process.cwd(), 'certs', 'server.key');
  const caPath = path.resolve(process.cwd(), 'certs', 'rootCA.crt');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const certPem = fs.readFileSync(certPath, 'utf8');
    const caPem = fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : '';
    const httpsGateway = https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: caPem ? `${certPem}\n${caPem}` : certPem,
      },
      handleGatewayRequest('https')
    );
    httpsGateway.on('error', (err: any) => {
      console.warn(`[Port 443 HTTPS Gateway] Could not bind port 443 (${err.code || err.message})`);
    });
    httpsGateway.listen(443, '0.0.0.0', () => {
      console.log(`[Port 443 HTTPS Gateway] Hosting custom domains on https://0.0.0.0:443 -> Backend(:${backendPort}) & Frontend(:${frontendPort})`);
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: env.TRUST_PROXY,
    })
  );

  // Security Headers (M5: HSTS and CSP configured; CSP enabled in production for HTML error templates & security)
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    } : false,
    hsts: env.NODE_ENV === 'production',
  });

  // Strict CORS (M4: In production, wildcard '*' with credentials enabled must resolve to actual origins)
  let corsOrigins: any = true;
  if (env.CORS_ORIGINS && env.CORS_ORIGINS !== '*') {
    corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  } else if (env.NODE_ENV === 'production') {
    corsOrigins = [env.BASE_URL, 'https://go.jupsoft.com', 'https://api.jupsoft.com'].filter(Boolean);
  }
  app.enableCors({ origin: corsOrigins, credentials: true });
  
  app.useGlobalFilters(new ErrorHandlerFilter());
  
  // Register Fastify hook to populate req.geoUa on all incoming requests (native Fastify hook)
  const geoMiddleware = new GeoUAMiddleware();
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', async (req: any, reply: any) => {
    geoMiddleware.use(req, reply, () => {});
  });


  // Removed ValidationPipe as Zod is used for validation within controllers

  // Security M3: Swagger API docs gated in production environments
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Jupsoft Shortly API')
      .setDescription('The API documentation for the Jupsoft Link Management Platform (JLMP)')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'Api-Key')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
  await app.listen(env.PORT, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);

  if (Number(env.PORT) !== 80 && env.NODE_ENV !== 'production') {
    startLocalDomainGateways(Number(env.PORT), Number(process.env.FRONTEND_PORT || 5001));
  }
}
void bootstrap();
