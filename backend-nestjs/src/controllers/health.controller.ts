import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService
  ) {}

  @Get()
  async getHealth(@Res() reply: FastifyReply) {
    let dbStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await this.db.pool.query('SELECT 1');
    } catch {
      dbStatus = 'degraded';
    }

    try {
      await this.redis.client.ping();
    } catch {
      redisStatus = 'degraded';
    }

    const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    });
  }
}
