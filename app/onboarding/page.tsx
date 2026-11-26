import { redirect } from 'next/navigation'

import { getCurrentUser } from '../actions/auth'
import { OnboardingForm } from '@/components/onboarding-form'

export default async function OnboardingPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.uniqueCode) {
    redirect('/dashboard')
  }

  return (
    <main
      id="main"
      className="min-h-screen bg-secondary flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl">
        <OnboardingForm />
      </div>
    </main>
  )
}
