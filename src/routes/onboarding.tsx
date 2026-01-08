import { createFileRoute, redirect } from '@tanstack/react-router'

import { OnboardingForm } from '@/components/onboarding-form'
import { getCurrentUserFn } from '@/lib/server-functions/auth'

export const Route = createFileRoute('/onboarding')({
  loader: async () => {
    const user = await getCurrentUserFn()

    if (!user) {
      throw redirect({
        to: '/login',
      })
    }

    // If already onboarded (has uniqueCode), redirect to dashboard
    // Check uniqueCode from DB to determine if onboarding is complete
    if (user.uniqueCode) {
      throw redirect({
        to: '/dashboard',
      })
    }

    return { user }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <OnboardingForm />
      </div>
    </main>
  )
}

