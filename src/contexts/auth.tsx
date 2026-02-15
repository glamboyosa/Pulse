import { createContext, useContext, ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'

import { getCurrentUserFn } from '@/lib/server-functions/auth'

type User = {
  id: string
  email: string
  name: string
  businessName: string | null
  businessType: string | null
  uniqueCode: string | null
  isVerified: boolean
  pulsesRemaining: number
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const _user = useServerFn(getCurrentUserFn)
  const user = {} as User | null
  return (
    <AuthContext.Provider value={{ user, isLoading: false, refetch: () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

