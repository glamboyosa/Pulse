'use client'

import { useActionState, useEffect, useState } from 'react'

import { loginAction } from '../../app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { TurnstileWidget } from '@/components/turnstile-widget'

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

type LoginStep = 'email' | 'otp'

/** `next`: where to go after signing in. */
export function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  // Each token works once, so a fresh widget follows every attempt.
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileFailed, setTurnstileFailed] = useState(false)
  const [loginState, loginFormAction, isPending] = useActionState(
    loginAction,
    undefined,
  )

  // Update error state when loginState changes
  useEffect(() => {
    if (loginState?.error) {
      setError(loginState.error)
    }
  }, [loginState])

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      })
      const data: { success?: boolean; error?: string } = await response
        .json()
        .catch(() => ({}))

      if (response.ok && data.success) {
        setStep('otp')
      } else {
        setError(data.error || 'Failed to send the code. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
      setTurnstileToken('')
      setTurnstileKey((key) => key + 1)
    }
  }

  // Update error state when loginState changes
  useEffect(() => {
    if (loginState?.error) {
      setError(loginState.error)
    }
  }, [loginState])

  if (step === 'otp') {
    return (
      <form action={loginFormAction} className="space-y-6">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="otpCode" value={otpCode} />
        <input type="hidden" name="next" value={next} />
        <div className="bg-card border-2 border-foreground shadow-brutal-lg p-8">
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="font-bold text-lg mb-2">
                Check your email for a code
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                We sent a 6-digit code to {email}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-2">
                If you do not see it within a minute, check spam or promotions.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm font-bold uppercase">
                Enter Code
              </Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => {
                    // Only allow numbers, max 6 digits
                    const numericValue = value.replace(/\D/g, '').slice(0, 6)
                    setOtpCode(numericValue)
                  }}
                  autoFocus
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {(error || loginState?.error) && (
              <div className="bg-destructive/10 border-2 border-destructive text-destructive-foreground p-4">
                <p className="font-bold text-sm">
                  {error || loginState?.error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending || otpCode.length !== 6}
              className="w-full text-lg font-bold border-2 border-foreground shadow-brutal hover:shadow-brutal-lg hover:translate-x-[-2px] hover:translate-y-[-2px] transition-[transform,box-shadow,background-color]"
            >
              {isPending ? 'VERIFYING…' : 'VERIFY CODE'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep('email')
                setOtpCode('')
                setError('')
              }}
              className="w-full font-bold border-2 border-transparent hover:border-foreground"
            >
              Change email
            </Button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleEmailSubmit} className="space-y-6">
      <div className="bg-card border-2 border-foreground shadow-brutal-lg p-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold uppercase">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-2 border-foreground font-semibold"
            />
          </div>

          {turnstileSiteKey && (
            <TurnstileWidget
              key={turnstileKey}
              siteKey={turnstileSiteKey}
              onToken={(token) => {
                setTurnstileToken(token)
                if (token) setTurnstileFailed(false)
              }}
              onError={() => setTurnstileFailed(true)}
            />
          )}

          {turnstileFailed && (
            <div className="bg-destructive/10 border-2 border-destructive p-4 space-y-2">
              <p className="font-bold text-sm">
                We couldn&apos;t run the check that stops bots. If you use an ad
                or tracker blocker, allow this page, then try again.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTurnstileFailed(false)
                  setTurnstileKey((key) => key + 1)
                }}
              >
                Try again
              </Button>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border-2 border-destructive text-destructive-foreground p-4">
              <p className="font-bold text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || (!!turnstileSiteKey && !turnstileToken)}
            className="w-full text-lg font-bold border-2 border-foreground shadow-brutal hover:shadow-brutal-lg hover:translate-x-[-2px] hover:translate-y-[-2px] transition-[transform,box-shadow,background-color]"
          >
            {isLoading
              ? 'SENDING CODE…'
              : turnstileSiteKey && !turnstileToken && !turnstileFailed
                ? 'CHECKING YOU’RE HUMAN…'
                : 'SEND LOGIN CODE'}
          </Button>
        </div>
      </div>
    </form>
  )
}
