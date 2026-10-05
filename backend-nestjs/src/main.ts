import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

import { env } from './config/env.js';

import { ErrorHandlerFilter } from './common/filters/error-handler.filter.js';
import { GeoUAMiddleware } from './common/middleware/geo-ua.middleware.js';

import * as http from 'node:http';
import helmet from '@fastify/helmet';

function startLocalPort80Gateway(backendPort: number, frontendPort = 5000) {
  const FRONTEND_PREFIXES = [
    '/_next',
    '/api/proxy',
    '/links',
    '/reports',
    '/settings',
    '/help',
    '/login',
    '/favicon.ico',
    '/jupsoft-logo.png',
  ];

  const gateway = http.createServer((clientReq, clientRes) => {
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
  });

  gateway.on('error', (err: any) => {
    console.warn(`[Port 80 Gateway] Could not bind port 80 (${err.code || err.message})`);
  });

  gateway.listen(80, '0.0.0.0', () => {
    console.log(`[Port 80 Gateway] Hosting custom domains locally on http://0.0.0.0:80 -> Backend(:${backendPort}) & Frontend(:${frontendPort})`);
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  // Security Headers (disable HSTS on HTTP/local so browsers don't force-upgrade http:// custom domains to https://)
  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: false,
  });

  // Strict CORS
  const corsOrigins = env.CORS_ORIGINS === '*' ? '*' : env.CORS_ORIGINS.split(',').map(o => o.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });
  
  app.useGlobalFilters(new ErrorHandlerFilter());
  
  // Register Fastify hook & middleware to populate req.geoUa on all incoming requests
  const geoMiddleware = new GeoUAMiddleware();
  app.use((req: any, res: any, next: any) => geoMiddleware.use(req, res, next));
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', async (req: any, reply: any) => {
    geoMiddleware.use(req, reply, () => {});
  });

  // Removed ValidationPipe as Zod is used for validation within controllers

  const config = new DocumentBuilder()
    .setTitle('Jupsoft Shortly API')
    .setDescription('The API documentation for the Jupsoft Link Management Platform (JLMP)')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'Api-Key')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(env.PORT, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);

  if (Number(env.PORT) !== 80) {
    startLocalPort80Gateway(Number(env.PORT), 5000);
  }
}
bootstrap();
