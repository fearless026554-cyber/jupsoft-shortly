import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

import { env } from './config/env.js';

import { ErrorHandlerFilter } from './common/filters/error-handler.filter.js';
import { GeoUAMiddleware } from './common/middleware/geo-ua.middleware.js';

import helmet from '@fastify/helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  // Security Headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // In a strict production environment, define proper CSP here.
  });

  // Strict CORS
  const corsOrigins = env.CORS_ORIGINS === '*' ? '*' : env.CORS_ORIGINS.split(',').map(o => o.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });
  
  app.useGlobalFilters(new ErrorHandlerFilter());
  
  // Register Fastify middleware directly since it's a Fastify plugin/middleware equivalent
  const geoMiddleware = new GeoUAMiddleware();
  app.use((req: any, res: any, next: any) => geoMiddleware.use(req, res, next));

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
}
bootstrap();
