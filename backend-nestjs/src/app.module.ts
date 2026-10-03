import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './db/database.module.js';
import { RedisModule } from './redis/redis.module.js';
import { env } from './config/env.js';
import { QueueNames } from './constants/index.js';
import { RedirectController } from './controllers/redirect.controller.js';
import { LinksController } from './controllers/links.controller.js';
import { TenantsController } from './controllers/tenants.controller.js';
import { DomainsController } from './controllers/domains.controller.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { OutcomesController } from './controllers/outcomes.controller.js';
import { AbuseController } from './controllers/abuse.controller.js';
import { ApiKeysController } from './controllers/api-keys.controller.js';
import { UsersController } from './controllers/users.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { ClickProcessor } from './workers/click.processor.js';
import { BulkProcessor } from './workers/bulk.processor.js';
import { ScreeningProcessor } from './workers/screening.processor.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per IP per minute
    }]),
    DatabaseModule,
    RedisModule,
    BullModule.forRoot({
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue({ name: QueueNames.CLICKS }),
    BullModule.registerQueue({ name: QueueNames.BULK_LINKS }),
    BullModule.registerQueue({ name: QueueNames.URL_SCREENING }),
  ],
  controllers: [
    RedirectController,
    LinksController,
    TenantsController,
    DomainsController,
    AnalyticsController,
    OutcomesController,
    AbuseController,
    ApiKeysController,
    UsersController,
    HealthController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ClickProcessor,
    BulkProcessor,
    ScreeningProcessor,
  ],
})
export class AppModule {}
