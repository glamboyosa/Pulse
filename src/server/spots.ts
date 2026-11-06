import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@/db/index'
import { spots } from '@/db/schema'

export const MAX_SPOTS = 50
export const MAX_SPOT_NAME = 60

export class SpotError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type Spot = { id: string; name: string; slug: string }

/** "Lekki branch – Table 4" becomes "lekki-branch-table-4". */
export const slugify = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '') || 'spot'

const active = (userId: string) =>
  and(eq(spots.userId, userId), isNull(spots.archivedAt))

export const listSpots = (userId: string): Promise<Array<Spot>> =>
  db
    .select({ id: spots.id, name: spots.name, slug: spots.slug })
    .from(spots)
    .where(active(userId))
    .orderBy(asc(spots.createdAt))

/**
 * Adds a spot with a slug unique for this owner, even among archived spots,
 * so an old printed QR code never starts tagging feedback for a new place.
 */
export const createSpot = async (
  userId: string,
  rawName: string,
): Promise<Spot> => {
  const name = rawName.trim().replace(/\s+/g, ' ')
  if (!name) throw new SpotError('Give the spot a name', 400)
  if (name.length > MAX_SPOT_NAME) {
    throw new SpotError(`Keep the name under ${MAX_SPOT_NAME} characters`, 400)
  }
  // Counted before inserting, so two adds at once can reach MAX_SPOTS + 1.
  // Harmless: the limit only keeps the list manageable.
  const current = await listSpots(userId)
  if (current.some((spot) => spot.name.toLowerCase() === name.toLowerCase())) {
    throw new SpotError(`You already have a spot called ${name}`, 409)
  }
  if (current.length >= MAX_SPOTS) {
    throw new SpotError(`You can have up to ${MAX_SPOTS} spots`, 400)
  }

  const base = slugify(name)
  for (let n = 1; n <= 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    const created = (
      await db
        .insert(spots)
        .values({ userId, name, slug })
        .onConflictDoNothing()
        .returning({ id: spots.id, name: spots.name, slug: spots.slug })
    ).at(0)
    if (created) return created
  }
  throw new SpotError('Try a different name', 409)
}

/** Archives one of the owner's spots. Returns false if it isn't theirs. */
export const archiveSpot = async (userId: string, spotId: string) => {
  const archived = await db
    .update(spots)
    .set({ archivedAt: new Date() })
    .where(and(eq(spots.id, spotId), active(userId)))
    .returning({ id: spots.id })
  return archived.length > 0
}

/** The active spot a QR link names, or null for none, unknown or archived. */
export const findSpot = async (
  userId: string,
  slug: string | null | undefined,
): Promise<Spot | null> => {
  if (!slug) return null
  return (
    (
      await db
        .select({ id: spots.id, name: spots.name, slug: spots.slug })
        .from(spots)
        .where(and(active(userId), eq(spots.slug, slug)))
        .limit(1)
    ).at(0) ?? null
  )
}
