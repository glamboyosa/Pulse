'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Zap } from 'lucide-react'

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

  const handleLogout = async () => {
    await logoutAction()
    // logoutAction will redirect
  }

  return (
    <header className="border-b-4 border-foreground bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PulseLogo className="w-10 h-10 text-primary" />
            <span className="text-2xl font-bold tracking-tight">PULSE</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/buy-pulses">
              <Button
                variant="outline"
                className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-accent hover:bg-accent/80"
              >
                <Zap className="w-4 h-4 mr-2" fill="currentColor" />
                <span className="hidden sm:inline">
                  {user.pulsesRemaining || 0} Pulses
                </span>
                <span className="sm:hidden">{user.pulsesRemaining || 0}</span>
              </Button>
            </Link>
            <div className="hidden md:block text-right">
              <p className="font-bold">{user.name}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {user.email}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent"
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
