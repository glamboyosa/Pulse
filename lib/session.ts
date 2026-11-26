import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

type SessionPayload = {
  userId: string
  email: string
  expiresAt: Date
}

const secretKey = process.env.SESSION_SECRET
if (!secretKey || secretKey.length < 32) {
  throw new Error('SESSION_SECRET must be set to at least 32 characters')
}
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(
  payload: Omit<SessionPayload, 'expiresAt'> & { expiresAt: Date },
) {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(
  session: string | undefined = '',
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(userId: string, email: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, email, expiresAt })

  const cookieStore = await cookies()

  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  return await decrypt(session)
}
