import { config } from 'dotenv'

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../env'
import * as schema from './schema'

config()

const pool = new Pool({
  connectionString: env.DATABASE_URL,
})

// Keep every session in UTC so SQL now() matches Drizzle's UTC Date serialization.
pool.on('connect', (client) => {
  void client.query("SET TIME ZONE 'UTC'").catch((error: unknown) => {
    console.error('[db] failed to set UTC session timezone', error)
  })
})

export const db = drizzle(pool, { schema })
