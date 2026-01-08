import { redirect } from 'next/navigation'

import { OnboardingForm } from '@/components/onboarding-form'
import { getCurrentUser } from '../actions/auth'

export default async function OnboardingPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // If already onboarded (has uniqueCode), redirect to dashboard
  if (user.uniqueCode) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <OnboardingForm />
      </div>
    </main>
  )
}
