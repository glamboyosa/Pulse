import { createHmac } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/index'
import { freePulseGrants } from '@/db/schema'
import { env } from '@/env'
import { RateLimitError, enforceRateLimit } from '@/server/rate-limit'

/** The database, or a transaction the caller runs the signup in. */
type Executor = Pick<typeof db, 'select' | 'insert' | 'execute'>

// New businesses get this many pulses to try Pulse.
export const FREE_PULSES_ON_SIGNUP = 5
// Shared office wifi, or a mobile carrier putting many people behind one
// address, can hold a few real businesses; more than that from one connection
// in 30 days is someone collecting free pulses.
export const FREE_SIGNUPS_PER_CONNECTION = 3
const CONNECTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Why a new account got no free pulses, for the founder's signup alert. */
export type NoFreePulsesReason = 'inbox' | 'connection'

const GMAIL = ['gmail.com', 'googlemail.com']

/**
 * The inbox an address delivers to. Mail providers ignore anything after a
 * "+", and Gmail also ignores dots, so these all reach one person.
 */
export const mailboxOf = (email: string) => {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@')
  const name = local.split('+')[0]
  return GMAIL.includes(domain)
    ? `${name.replaceAll('.', '')}@gmail.com`
    : `${name}@${domain}`
}

// mailboxOf in SQL, for comparing with accounts from before grants were
// recorded. A full scan, which is fine at signup volume.
const accountMailbox = sql`case
  when split_part(lower(email), '@', 2) in ('gmail.com', 'googlemail.com')
    then replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') || '@gmail.com'
  else split_part(split_part(lower(email), '@', 1), '+', 1) || '@' || split_part(lower(email), '@', 2)
end`

/**
 * The network a connection belongs to. Phones and home routers pick any
 * IPv6 address in their /64 block, so the block counts as one connection.
 */
export const networkOf = (ip: string) => {
  // An IPv4 address some servers write in IPv6 form: ::ffff:198.51.100.7.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return mapped[1]
  if (!ip.includes(':')) return ip
  const [head = '', tail = ''] = ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = !ip.includes('::')
    ? left
    : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

/** Keyed, so a stored fingerprint can't be turned back into what it hides. */
const fingerprint = (purpose: string, value: string) => {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set')
  return createHmac('sha256', env.SESSION_SECRET)
    .update(`${purpose}:${value}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * The pulses a brand-new account starts with. None when its inbox already had
 * them (even on an account since deleted), or when its connection already got
 * them for three new accounts in 30 days. Signing up works either way.
 * Run it in the transaction that creates the account, so a failed signup
 * doesn't use up the inbox's free pulses.
 */
export const freePulsesFor = async (
  email: string,
  ip: string | null,
  executor: Executor = db,
): Promise<
  { pulses: number; reason: null } | { pulses: 0; reason: NoFreePulsesReason }
> => {
  const mailboxHash = fingerprint('mailbox', mailboxOf(email))
  const grants = await executor
    .select({ mailboxHash: freePulseGrants.mailboxHash })
    .from(freePulseGrants)
    .where(eq(freePulseGrants.mailboxHash, mailboxHash))
  const sameInbox = await executor.execute(
    sql`select 1 from users where ${accountMailbox} = ${mailboxOf(email)} limit 1`,
  )
  if (grants.length > 0 || sameInbox.rows.length > 0) {
    return { pulses: 0, reason: 'inbox' }
  }

  // Without an address every signup would share one counter, so skip it.
  if (ip) {
    try {
      await enforceRateLimit(
        `free-pulses:ip:${fingerprint('signup-network', networkOf(ip))}`,
        FREE_SIGNUPS_PER_CONNECTION,
        CONNECTION_WINDOW_MS,
        executor,
      )
    } catch (error) {
      if (error instanceof RateLimitError) {
        return { pulses: 0, reason: 'connection' }
      }
      throw error
    }
  }

  // Claimed in one statement, so two spellings of one inbox signing up at the
  // same moment can't both get them.
  const claimed = await executor
    .insert(freePulseGrants)
    .values({ mailboxHash })
    .onConflictDoNothing()
    .returning({ mailboxHash: freePulseGrants.mailboxHash })
  return claimed.length > 0
    ? { pulses: FREE_PULSES_ON_SIGNUP, reason: null }
    : { pulses: 0, reason: 'inbox' }
}
