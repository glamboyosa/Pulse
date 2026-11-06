import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    SERVER_RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
    // Vercel sends it as a bearer token on cron requests.
    CRON_SECRET: z.string().min(1).optional(),
    DATABASE_URL: z.string().url().optional(),
    ELEVEN_LABS_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    POLAR_API_KEY: z.string().min(1).optional(),
    POLAR_SANDBOX_API_TOKEN: z.string().default(''),
    POLAR_WEBHOOK_SECRET: z.string().min(1).optional(),
    POLAR_SANDBOX_WEBHOOK_SECRET: z.string().default(''),
    POLAR_ENVIRONMENT: z.enum(['sandbox', 'production']).default('production'),
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
    CLOUDFLARE_ACCESS_KEY_ID: z.string().min(1).optional(),
    CLOUDFLARE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    CLOUDFLARE_R2_BUCKET_NAME: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
  },

  client: {
    NEXT_PUBLIC_APP_TITLE: z.string().min(1).optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },

  runtimeEnv: {
    SERVER_URL: process.env.SERVER_URL,
    SERVER_RESEND_API_KEY: process.env.SERVER_RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    ELEVEN_LABS_API_KEY: process.env.ELEVEN_LABS_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    POLAR_API_KEY: process.env.POLAR_API_KEY,
    POLAR_SANDBOX_API_TOKEN: process.env.POLAR_SANDBOX_API_TOKEN || '',
    POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
    POLAR_SANDBOX_WEBHOOK_SECRET:
      process.env.POLAR_SANDBOX_WEBHOOK_SECRET || '',
    POLAR_ENVIRONMENT: process.env.POLAR_ENVIRONMENT,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_ACCESS_KEY_ID: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    CLOUDFLARE_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NEXT_PUBLIC_APP_TITLE: process.env.NEXT_PUBLIC_APP_TITLE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  emptyStringAsUndefined: true,
})
