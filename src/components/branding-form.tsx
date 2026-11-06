'use client'

import { useState } from 'react'
import { Check, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import type { BrandingInput } from '@/server/branding'
import { ACCENTS, LIMITS } from '@/lib/branding-options'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const cardClass =
  'p-6 border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-card space-y-3'
const inputClass = 'border-4 border-foreground font-semibold text-base'

const readError = async (response: Response) =>
  ((await response.json().catch(() => ({}))) as { error?: string }).error ??
  'Something went wrong. Try again.'

export function BrandingForm({
  businessName,
  feedbackUrl,
  initial,
  logoUrl,
}: {
  businessName: string
  feedbackUrl: string
  initial: BrandingInput
  logoUrl: string | null
}) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [logoBusy, setLogoBusy] = useState(false)

  const set = (field: keyof BrandingInput) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setState('idle')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setState('saving')
    setError(null)
    const response = await fetch('/api/settings/branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }).catch(() => null)
    if (response?.ok) {
      setState('saved')
      router.refresh()
      return
    }
    setState('idle')
    setError(
      response
        ? await readError(response)
        : "Couldn't save. Check your connection.",
    )
  }

  const uploadLogo = async (file: File) => {
    setLogoBusy(true)
    setError(null)
    const form = new FormData()
    form.append('logo', file)
    const response = await fetch('/api/settings/logo', {
      method: 'POST',
      body: form,
    }).catch(() => null)
    setLogoBusy(false)
    if (response?.ok) router.refresh()
    else
      setError(
        response ? await readError(response) : "Couldn't upload the logo.",
      )
  }

  const deleteLogo = async () => {
    setLogoBusy(true)
    setError(null)
    const response = await fetch('/api/settings/logo', {
      method: 'DELETE',
    }).catch(() => null)
    setLogoBusy(false)
    if (response?.ok) router.refresh()
    else setError("Couldn't remove the logo.")
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card className={cardClass}>
        <h2 className="text-xl font-black">LOGO</h2>
        <div className="flex items-center gap-4">
          <div className="size-20 border-4 border-foreground bg-background flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${businessName} logo`}
                className="size-full object-contain"
              />
            ) : (
              <span className="text-2xl font-black">
                {businessName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Label
              htmlFor="logo"
              className="inline-flex cursor-pointer items-center gap-2 border-4 border-foreground bg-background px-4 py-2 font-bold has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
            >
              <ImagePlus className="size-4" />
              {logoUrl ? 'REPLACE' : 'UPLOAD'}
              <input
                id="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={logoBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadLogo(file)
                  event.target.value = ''
                }}
              />
            </Label>
            {logoUrl && (
              <Button
                type="button"
                variant="outline"
                disabled={logoBusy}
                onClick={deleteLogo}
                className="border-4 border-foreground font-bold"
              >
                <Trash2 className="size-4 mr-2" />
                REMOVE
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          PNG, JPEG or WebP, up to 1 MB.
        </p>
      </Card>

      <Card className={cardClass}>
        <Label htmlFor="question" className="text-xl font-black">
          YOUR QUESTION
        </Label>
        <Input
          id="question"
          value={values.feedbackQuestion}
          onChange={(event) => set('feedbackQuestion')(event.target.value)}
          maxLength={LIMITS.question}
          placeholder="How was your meal tonight?"
          className={inputClass}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          The headline customers see. Leave blank for “Share your feedback”.
        </p>
      </Card>

      <Card className={cardClass}>
        <fieldset>
          <legend className="text-xl font-black mb-3">ACCENT</legend>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACCENTS).map(([name, hex]) => (
              <label key={name} className="cursor-pointer">
                <input
                  type="radio"
                  name="accent"
                  value={name}
                  checked={values.accentColor === name}
                  onChange={() => set('accentColor')(name)}
                  className="peer sr-only"
                />
                <span
                  className="flex size-11 items-center justify-center border-4 border-foreground peer-checked:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                  style={{ backgroundColor: hex }}
                >
                  {values.accentColor === name && (
                    <Check className="size-5 text-white" strokeWidth={3} />
                  )}
                </span>
                <span className="sr-only">{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className={cardClass}>
        <Label htmlFor="thank-you" className="text-xl font-black">
          THANK-YOU MESSAGE
        </Label>
        <Input
          id="thank-you"
          value={values.thankYouMessage}
          onChange={(event) => set('thankYouMessage')(event.target.value)}
          maxLength={LIMITS.thankYou}
          placeholder="Show this screen for 10% off your next visit"
          className={inputClass}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          Shown to everyone after they send feedback, whatever they said.
        </p>
      </Card>

      <Card className={cardClass}>
        <Label htmlFor="review" className="text-xl font-black">
          GOOGLE REVIEW LINK
        </Label>
        <Input
          id="review"
          type="url"
          inputMode="url"
          value={values.googleReviewUrl}
          onChange={(event) => set('googleReviewUrl')(event.target.value)}
          placeholder="https://g.page/r/…/review"
          className={inputClass}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          Every customer is invited to post a review after sending feedback.
          Google’s rules don’t allow asking only happy customers, so Pulse never
          does.
        </p>
      </Card>

      {error && (
        <p
          role="alert"
          className="border-4 border-foreground bg-red-100 p-3 font-bold"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          disabled={state === 'saving'}
          className="text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] px-8 py-6 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        >
          {state === 'saving'
            ? 'SAVING…'
            : state === 'saved'
              ? 'SAVED'
              : 'SAVE'}
        </Button>
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 font-bold underline underline-offset-4"
        >
          See your page <ExternalLink className="size-4" />
        </a>
      </div>
    </form>
  )
}
