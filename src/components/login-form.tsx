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
import { api } from '@/lib/eden'

type LoginStep = 'email' | 'otp'

export function LoginForm() {
  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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
    console.log('[LoginForm] handleEmailSubmit called', { email })
    setError('')
    setIsLoading(true)

    try {
      console.log('[LoginForm] Creating API client...')
      const apiClient = api
      console.log('[LoginForm] API client created, calling send-otp...', {
        email,
        apiClient: !!apiClient,
        authEndpoint: true,
      })

      // Use the full path for the API call
      const result = await apiClient.auth['send-otp'].post({
        email,
      })

      console.log('[LoginForm] send-otp response:', result)

      if (result.data?.success) {
        console.log('[LoginForm] OTP sent successfully, moving to OTP step')
        setStep('otp')
      } else {
        console.error('[LoginForm] OTP send failed:', result.data)
        setError(result.data?.error || 'Failed to send OTP')
      }
    } catch (err) {
      console.error('[LoginForm] Error sending OTP:', err)
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
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
        <div className="bg-card border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
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
              <div className="bg-destructive/10 border-4 border-destructive text-destructive-foreground p-4">
                <p className="font-bold text-sm">
                  {error || loginState?.error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending || otpCode.length !== 6}
              className="w-full text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              {isPending ? 'VERIFYING...' : 'VERIFY CODE'}
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
      <div className="bg-card border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
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
              className="border-4 border-foreground font-semibold"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border-4 border-destructive text-destructive-foreground p-4">
              <p className="font-bold text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
          >
            {isLoading ? 'SENDING CODE...' : 'SEND LOGIN CODE'}
          </Button>
        </div>
      </div>
    </form>
  )
}
