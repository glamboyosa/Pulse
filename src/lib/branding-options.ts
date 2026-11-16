/** Accents an owner can pick. A short fixed list keeps every page legible. */
export const ACCENTS = {
  black: '#111111',
  red: '#dc2626',
  orange: '#c2410c',
  green: '#15803d',
  blue: '#2563eb',
  purple: '#7c3aed',
} as const
export type Accent = keyof typeof ACCENTS

export const LIMITS = { question: 120, thankYou: 200, logoBytes: 1024 * 1024 }
