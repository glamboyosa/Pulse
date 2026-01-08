import { redirect } from 'next/navigation'
import Link from 'next/link'

import { LoginForm } from '@/components/login-form'
import { PulseLogo } from '@/components/pulse-logo'
import { getCurrentUser } from '../actions/auth'

export default async function LoginPage() {
  // If user is already logged in, redirect to dashboard or onboarding
  const user = await getCurrentUser()

  if (user) {
    // If user has completed onboarding, go to dashboard
    // Otherwise, go to onboarding
    if (user.uniqueCode) {
      redirect('/dashboard')
    } else {
      redirect('/onboarding')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <PulseLogo className="w-12 h-12 text-primary" />
            <span className="text-3xl font-bold tracking-tight">PULSE</span>
          </Link>
          <h1 className="text-4xl font-black mb-2">WELCOME BACK</h1>
          <p className="text-lg font-semibold">Log in to your account</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
