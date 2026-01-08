import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load environment variables from .env.local first, then .env
config({ path: '.env.local' })
config()

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Please set it in your .env or .env.local file.',
  )
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
})
