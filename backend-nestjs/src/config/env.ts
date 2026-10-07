import { z } from 'zod';
import * as dotenv from 'dotenv';
import { CACHE_TTL, RATE_LIMITS } from './constants.js';

if (process.env.BASE_URL === '/') {
  delete process.env.BASE_URL;
}
dotenv.config();

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535),
    HOST: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // Base URLs & Domains (Optional overrides from env — auto-resolves from Database if omitted)
    BASE_URL: z.string().url('BASE_URL must be a valid URL').optional().default('https://localhost:3000'),
    DEFAULT_DOMAIN_ID: z
      .string()
      .regex(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
        'DEFAULT_DOMAIN_ID must be a valid UUID'
      )
      .optional()
      .default('0bb05033-f0ae-4779-b747-d386b8d67be1'),
    DEFAULT_DOMAIN_HOST: z.string().optional().default('localhost'),

    // Security & Networking (Required from env — no hardcoded defaults)
    CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
    TRUST_PROXY: z.coerce.boolean().default(false),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET is required and must be at least 32 characters long'),
    JWT_EXPIRY: z.string().default('1d'),

    // PostgreSQL Database (Required from env — no hardcoded defaults)
    PG_HOST: z.string().min(1, 'PG_HOST is required'),
    PG_PORT: z.coerce.number().int().default(5432),
    PG_DATABASE: z.string().min(1, 'PG_DATABASE is required'),
    PG_USER: z.string().min(1, 'PG_USER is required'),
    PG_PASSWORD: z.string().min(1, 'PG_PASSWORD is required'),
    PG_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
    PG_IDLE_TIMEOUT_MS: z.coerce.number().int().default(30000),
    PG_CONN_TIMEOUT_MS: z.coerce.number().int().default(5000),
    PG_SSL: z.coerce.boolean().default(false),

    // Redis Cache & Queues
    REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Scalable Worker Concurrencies
    CLICK_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
    BULK_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(2),
    SCREENING_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),

    // Rate Limiting
    RATE_LIMIT_STANDARD_RPM: z.coerce.number().int().default(RATE_LIMITS.STANDARD_RPM),
    RATE_LIMIT_INTERNAL_RPM: z.coerce.number().int().default(RATE_LIMITS.INTERNAL_RPM),

    // Cache TTLs
    CACHE_LINK_TTL_SEC: z.coerce.number().int().default(CACHE_TTL.LINK_METADATA_SEC),
    CACHE_TENANT_TTL_SEC: z.coerce.number().int().default(CACHE_TTL.TENANT_STATUS_SEC),

    // Anti-Abuse & Screening Services
    SAFE_BROWSING_API_KEY: z.string().optional(),
    SAFE_BROWSING_ENDPOINT: z
      .string()
      .url()
      .default('https://safebrowsing.googleapis.com/v4/threatMatches:find'),

    // Google OAuth Authentication
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Server Networking & Public IP Override
    SERVER_PUBLIC_IP: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.PG_PASSWORD === 'postgres' || data.PG_PASSWORD.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PG_PASSWORD'],
          message: 'In production, PG_PASSWORD must be a strong secret (min 16 chars).',
        });
      }

      if (data.BASE_URL.includes('localhost') || data.BASE_URL.includes('127.0.0.1')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BASE_URL'],
          message: 'In production, BASE_URL cannot point to localhost.',
        });
      }

      if (!data.REDIS_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_PASSWORD'],
          message: 'In production, REDIS_PASSWORD is required.',
        });
      }

      if (!data.SAFE_BROWSING_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SAFE_BROWSING_API_KEY'],
          message: 'In production, SAFE_BROWSING_API_KEY is required to prevent phishing abuse.',
        });
      }

      if (data.CORS_ORIGINS === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'In production, CORS_ORIGINS must be a strict comma-separated list of allowed domains.',
        });
      }
    }
  });

// Safe parse with formatted fatal exit
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n======================================================');
  console.error('FATAL: Enterprise Environment Configuration Validation Failed');
  console.error('======================================================');
  for (const issue of result.error.issues) {
    console.error(`❌ [${issue.path.join('.')}] - ${issue.message}`);
  }
  console.error('======================================================\n');
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof envSchema>;
