import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { BuyPulsesForm } from '@/components/buy-pulses-form'
import { getCurrentUser } from '../actions/auth'

export default async function BuyPulsesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold text-foreground hover:text-primary mb-8 border-2 border-transparent hover:border-foreground px-3 py-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="mb-8">
          <h1 className="text-5xl font-black mb-4">BUY PULSES</h1>
          <p className="text-xl font-semibold text-muted-foreground">
            Each pulse = one voice feedback submission. Top up anytime.
          </p>
        </div>
        <BuyPulsesForm user={user} />
      </div>
    </div>
  )
}
