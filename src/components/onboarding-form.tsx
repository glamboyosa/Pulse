'use client'

import { useActionState, useState } from 'react'

import { completeOnboardingAction } from '../../app/actions/onboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CHANNELS = [
  {
    id: 'venue',
    title: 'In person',
    body: 'A QR code on tables, counters or receipts',
  },
  {
    id: 'website',
    title: 'On my website or app',
    body: 'A feedback button on your pages',
  },
  { id: 'both', title: 'Both', body: 'QR codes and a website button' },
] as const

type Channel = (typeof CHANNELS)[number]['id']

const BUSINESS_TYPES = [
  'Restaurant',
  'Bar',
  'Retail Store',
  'Salon/Spa',
  'Fitness Center',
  'Hotel',
  'Healthcare',
  'Consulting',
  'Software or app',
  'Online store',
  'Other',
]

const LAST_STEP = 4

export function OnboardingForm() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<{
    businessName: string
    channel: Channel | ''
    businessType: string
    uniqueCode: string
  }>({
    businessName: '',
    channel: '',
    businessType: '',
    uniqueCode: '',
  })
  const [completeState, completeAction, isPending] = useActionState(
    completeOnboardingAction,
    undefined,
  )

  const handleStepSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (step === 1) {
      if (!formData.businessName.trim()) {
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!formData.channel) {
        return
      }
      setStep(3)
    } else if (step === 3) {
      if (!formData.businessType) {
        return
      }
      setStep(4)
    }
    // The last step uses the form action directly
  }

  const error = completeState?.error

  return (
    <div className="border-2 border-foreground bg-card p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className={`h-2 flex-1 ${
                num <= step ? 'bg-primary' : 'bg-muted'
              } border-2 border-foreground`}
            />
          ))}
        </div>
        <h1 id="onboarding-title" className="text-3xl font-bold mb-2">
          {step === 1 && 'Welcome to Pulse'}
          {step === 2 && 'Where will people leave feedback?'}
          {step === 3 && 'Tell us about your business'}
          {step === 4 && 'Create your unique link'}
        </h1>
        <p className="text-muted-foreground">
          {step === 1 &&
            "Let's get your business set up to collect voice feedback"}
          {step === 3 && 'This helps us customize your experience'}
          {step === 4 && 'This will be your custom feedback collection URL'}
        </p>
      </div>

      <form
        action={step === LAST_STEP ? completeAction : undefined}
        onSubmit={step < LAST_STEP ? handleStepSubmit : undefined}
        className="space-y-6"
      >
        {step === LAST_STEP && (
          <>
            <input type="hidden" name="channel" value={formData.channel} />
            <input
              type="hidden"
              name="businessName"
              value={formData.businessName}
            />
            <input
              type="hidden"
              name="businessType"
              value={formData.businessType}
            />
            <input
              type="hidden"
              name="uniqueCode"
              value={formData.uniqueCode}
            />
          </>
        )}
        {step === 1 && (
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              placeholder="Enter your business name"
              value={formData.businessName}
              onChange={(e) =>
                setFormData({ ...formData, businessName: e.target.value })
              }
              className="border-2 border-foreground"
            />
          </div>
        )}

        {step === 2 && (
          <div
            role="group"
            aria-labelledby="onboarding-title"
            className="grid gap-3"
          >
            {CHANNELS.map((channel) => (
              <button
                key={channel.id}
                type="button"
                aria-pressed={formData.channel === channel.id}
                onClick={() =>
                  setFormData({ ...formData, channel: channel.id })
                }
                className={`p-4 border-3 border-foreground text-left transition-colors ${
                  formData.channel === channel.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <span className="block font-bold">{channel.title}</span>
                <span className="block text-sm font-medium opacity-80">
                  {channel.body}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Business Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, businessType: type })
                  }
                  className={`p-4 border-3 border-foreground text-left font-semibold transition-colors ${
                    formData.businessType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === LAST_STEP && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uniqueCode">Unique Code</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono">
                  pulseapp.click/f/
                </span>
                <Input
                  id="uniqueCode"
                  placeholder="your-business"
                  value={formData.uniqueCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      uniqueCode: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                  className="border-2 border-foreground font-mono"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This will be your custom feedback collection URL
              </p>
            </div>

            {formData.uniqueCode && (
              <div className="p-4 bg-accent border-2 border-foreground">
                <p className="text-sm font-semibold mb-1">
                  Your feedback URL will be:
                </p>
                <p className="font-mono text-primary break-all">
                  https://pulseapp.click/f/{formData.uniqueCode}
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border-2 border-destructive text-destructive text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={isPending}
              className="border-2 border-foreground"
            >
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              isPending ||
              (step === LAST_STEP &&
                (!formData.uniqueCode.trim() ||
                  !/^[a-z0-9-]+$/.test(formData.uniqueCode)))
            }
            className="flex-1 border-3 border-foreground"
          >
            {isPending
              ? 'Processing…'
              : step === LAST_STEP
                ? 'Complete Setup'
                : 'Continue'}
          </Button>
        </div>
      </form>
    </div>
  )
}
