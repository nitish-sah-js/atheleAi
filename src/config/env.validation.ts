import { z } from 'zod';

const durationSchema = z.string().min(1);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api/v1'),
  APP_NAME: z.string().default('AthleteShield'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: durationSchema.default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === 'true')
    .default(false),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  FILE_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_ROOT: z.string().default('uploads/encrypted'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional().default(''),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_S3_ENDPOINT: z.string().optional().default(''),
  AWS_S3_FORCE_PATH_STYLE: z
    .union([z.string(), z.boolean()])
    .transform((value) => value === true || value === 'true')
    .default(false),
  DOCUMENT_MASTER_KEY_BASE64: z.string().min(1),
  ED25519_PRIVATE_KEY_PEM_BASE64: z.string().optional().default(''),
  ED25519_PUBLIC_KEY_PEM_BASE64: z.string().optional().default(''),
  AI_SERVICE_URL: z.string().url(),
  AI_SERVICE_API_KEY: z.string().min(1),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_DEFAULT: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REPORTS: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_VERIFICATION: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  return parsed.data;
}

export function corsOriginsFromEnv(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
