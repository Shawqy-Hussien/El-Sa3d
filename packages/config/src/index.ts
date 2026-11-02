import { z } from 'zod';

const configSchema = z
  .object({
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith('postgresql://') || value.startsWith('postgres://'),
        {
          message: 'DATABASE_URL must use PostgreSQL',
        },
      ),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    PASSWORD_RESET_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(120)
      .default(30),
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(168)
      .default(24),
    WEB_ORIGINS: z
      .string()
      .default(
        'http://localhost:5173,http://localhost:5174,http://localhost:5175',
      )
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    COOKIE_SECURE: z.stringbool().default(false),
    MAIL_TRANSPORT: z.enum(['console', 'smtp']).default('console'),
    MAIL_FROM: z.string().email().default('pharmacy@example.invalid'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_DIRECTORY: z.string().default('storage/uploads'),
    STORAGE_PUBLIC_URL: z.string().url().optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((config, context) => {
    if (config.MAIL_TRANSPORT === 'smtp' && !config.SMTP_HOST) {
      context.addIssue({
        code: 'custom',
        message: 'SMTP_HOST is required when MAIL_TRANSPORT=smtp',
        path: ['SMTP_HOST'],
      });
    }
    if (
      (config.SMTP_USER && !config.SMTP_PASSWORD) ||
      (!config.SMTP_USER && config.SMTP_PASSWORD)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'SMTP_USER and SMTP_PASSWORD must be configured together',
        path: ['SMTP_USER'],
      });
    }
    if (
      config.STORAGE_DRIVER === 's3' &&
      (!config.S3_ENDPOINT || !config.S3_BUCKET)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'S3_ENDPOINT and S3_BUCKET are required when STORAGE_DRIVER=s3',
        path: ['S3_BUCKET'],
      });
    }
    if (
      (config.S3_ACCESS_KEY_ID && !config.S3_SECRET_ACCESS_KEY) ||
      (!config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together',
        path: ['S3_ACCESS_KEY_ID'],
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function parseConfig(environment: NodeJS.ProcessEnv): AppConfig {
  return configSchema.parse(environment);
}
