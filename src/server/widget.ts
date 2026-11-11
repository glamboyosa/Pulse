import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

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

/**
 * What the host website says about where a note was left. It comes from
 * someone else's page, so every field is optional, capped and shown as text.
 */
export type WidgetContext = {
  page?: string
  title?: string
  referrer?: string
  browser?: string
  screen?: string
  language?: string
  appVersion?: string
  userId?: string
  userEmail?: string
  custom?: Record<string, string>
}

export const MAX_CONTEXT_LENGTH = 4096
const MAX_CUSTOM_FIELDS = 10
const CUSTOM_KEY = /^[\w.-]{1,40}$/
// Safe as stored, but a later merge into an object could change its prototype.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim()
    ? value.trim().replace(/\s+/g, ' ').slice(0, max)
    : undefined

/** Only the path: query strings and fragments often hold tokens. */
const pathOf = (value: unknown) => {
  const raw = text(value, 2000)
  if (!raw) return undefined
  try {
    const url = new URL(raw, 'https://placeholder.invalid')
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    return url.pathname.slice(0, 300)
  } catch {
    return undefined
  }
}

const originOf = (value: unknown) => {
  const raw = text(value, 2000)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : undefined
  } catch {
    return undefined
  }
}

/** Parses the JSON the widget sends, keeping only known, capped fields. */
export const parseWidgetContext = (raw: string | undefined) => {
  if (!raw || raw.length > MAX_CONTEXT_LENGTH) return null
  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch {
    return null
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const source = input as Record<string, unknown>

  const custom = Object.fromEntries(
    Object.entries(
      source.custom &&
        typeof source.custom === 'object' &&
        !Array.isArray(source.custom)
        ? source.custom
        : {},
    )
      .filter(([key]) => CUSTOM_KEY.test(key) && !UNSAFE_KEYS.has(key))
      .flatMap(([key, value]) => {
        const cleaned = text(value, 200)
        return cleaned ? [[key, cleaned]] : []
      })
      .slice(0, MAX_CUSTOM_FIELDS),
  )

  const context: WidgetContext = {
    page: pathOf(source.page),
    title: text(source.title, 200),
    referrer: originOf(source.referrer),
    browser: text(source.browser, 300),
    screen: text(source.screen, 20),
    language: text(source.language, 20),
    appVersion: text(source.appVersion, 50),
    userId: text(source.userId, 100),
    userEmail: text(source.userEmail, 200),
    ...(Object.keys(custom).length > 0 && { custom }),
  }
  // A JSON round trip drops the fields that came out undefined.
  const kept = JSON.parse(JSON.stringify(context)) as WidgetContext
  return Object.keys(kept).length > 0 ? kept : null
}

/** Whether `key` is the live widget key of the business with `code`. */
export const isWidgetKeyFor = async (code: string, key: string) =>
  (
    await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.uniqueCode, code), eq(users.widgetKey, key)))
  ).length > 0
