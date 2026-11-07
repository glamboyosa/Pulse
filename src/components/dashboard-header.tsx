'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, Zap } from 'lucide-react'

import { logoutAction } from '../../app/actions/auth'
import { Button } from '@/components/ui/button'
import { PulseLogo } from '@/components/pulse-logo'

interface DashboardHeaderProps {
  user: {
    name: string
    email: string
    businessName: string | null
    pulsesRemaining?: number
  }
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter()
  const pulsesRemaining = user.pulsesRemaining || 0
  const isLowPulse = pulsesRemaining <= 3

  const handleLogout = async () => {
    await logoutAction()
    // logoutAction will redirect
  }

  return (
    <header className="border-b-2 border-foreground bg-background">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <PulseLogo className="size-8" />
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Pulse
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/buy-pulses">
              <Button
                variant="outline"
                className="font-bold border-2 border-foreground shadow-brutal-sm bg-accent hover:bg-accent/80"
              >
                <Zap className="w-4 h-4 mr-2" fill="currentColor" />
                <span className="hidden sm:inline">
                  {isLowPulse
                    ? `Buy More (${pulsesRemaining} left)`
                    : `${pulsesRemaining} Pulses`}
                </span>
                <span className="sm:hidden">
                  {isLowPulse ? 'Buy' : pulsesRemaining}
                </span>
              </Button>
            </Link>
            <div className="hidden md:block text-right">
              <p className="font-bold">{user.name}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {user.email}
              </p>
            </div>
            <Link
              href="/settings"
              aria-label="Feedback page settings"
              className="inline-flex size-10 items-center justify-center border-2 border-foreground shadow-brutal-sm bg-background"
            >
              <Settings className="size-4" />
            </Link>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="font-bold border-2 border-foreground shadow-brutal-sm bg-transparent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
