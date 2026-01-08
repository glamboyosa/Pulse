import { useSession } from '@tanstack/react-start/server'

type SessionData = {
  userId?: string
  email?: string
}

export function useAppSession() {
  return useSession<SessionData>({
    // Session configuration
    name: 'app-session',
    password: process.env.SESSION_SECRET || 'default-secret-key-change-in-production-min-32-chars', // At least 32 characters
    // Optional: customize cookie settings
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  })
}

