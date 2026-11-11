import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/db/index'
import { users } from '@/db/schema'

export const MAX_WIDGET_ORIGINS = 10

export class WidgetError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export type WidgetSettings = { key: string | null; origins: Array<string> }

const isLocalhost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '[::1]' ||
  hostname.startsWith('127.') ||
  hostname.endsWith('.localhost')

/**
 * Turns what an owner types ("conclave.click", "https://app.example.com/x")
 * into an origin like "https://conclave.click". HTTPS only, except
 * http://localhost so the widget can be tried on a dev server.
 */
export const parseOrigin = (input: string): string => {
  const trimmed = input.trim()
  if (!trimmed) throw new WidgetError('Enter a website address')
  if (trimmed.includes('*')) {
    throw new WidgetError(
      `List each website on its own line instead of "${trimmed}"`,
    )
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new WidgetError(`"${trimmed}" isn't a website address`)
  }
  // "example.com." is the same site, but browsers send "example.com".
  url.hostname = url.hostname.replace(/\.$/, '')
  const local = isLocalhost(url.hostname)
  const allowed =
    !url.username &&
    !url.password &&
    ((url.protocol === 'https:' && (url.hostname.includes('.') || local)) ||
      (url.protocol === 'http:' && local))
  if (!allowed) {
    throw new WidgetError(
      `"${trimmed}" must be an https:// address, like https://example.com`,
    )
  }
  return url.origin
}

export const widgetSettings = async (
  userId: string,
): Promise<WidgetSettings> => {
  const row = (
    await db
      .select({ key: users.widgetKey, origins: users.widgetOrigins })
      .from(users)
      .where(eq(users.id, userId))
  ).at(0)
  return { key: row?.key ?? null, origins: row?.origins ?? [] }
}

/** Creates the widget key, or replaces it so the old one stops working. */
export const createWidgetKey = async (userId: string): Promise<string> => {
  const key = `pk_${randomBytes(18).toString('base64url')}`
  await db
    .update(users)
    .set({ widgetKey: key, updatedAt: new Date() })
    .where(eq(users.id, userId))
  return key
}

/** Turns the widget off: the key stops working everywhere at once. */
export const removeWidgetKey = async (userId: string): Promise<void> => {
  await db
    .update(users)
    .set({ widgetKey: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export const setWidgetOrigins = async (
  userId: string,
  inputs: Array<string>,
): Promise<Array<string>> => {
  const origins = [...new Set(inputs.filter((i) => i.trim()).map(parseOrigin))]
  if (origins.length > MAX_WIDGET_ORIGINS) {
    throw new WidgetError(`Add at most ${MAX_WIDGET_ORIGINS} websites`)
  }
  await db
    .update(users)
    .set({ widgetOrigins: origins, updatedAt: new Date() })
    .where(eq(users.id, userId))
  return origins
}
