'use client'

import { useState } from 'react'

import type { VoucherSettings as Settings } from '@/server/vouchers'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const inputClass = 'border-2 border-foreground font-semibold text-base'

/** A reward for every customer who leaves feedback, whatever they say. */
export function VoucherSettings({
  initial,
  offerLimit,
}: {
  initial: Settings
  offerLimit: number
}) {
  const [values, setValues] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const update = (changes: Partial<Settings>) => {
    setValues((current) => ({ ...current, ...changes }))
    setState('idle')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setState('saving')
    setError(null)
    const response = await fetch('/api/settings/vouchers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }).catch(() => null)
    if (response?.ok) {
      setState('saved')
      return
    }
    setState('idle')
    setError(
      response
        ? (((await response.json().catch(() => ({}))) as { error?: string })
            .error ?? 'Something went wrong. Try again.')
        : 'Check your connection and try again.',
    )
  }

  return (
    <Card className="p-6 border-2 border-foreground shadow-brutal bg-card">
      <form onSubmit={save} className="space-y-4">
        <div>
          <h2 className="text-2xl font-black">Vouchers</h2>
          <p className="font-semibold text-muted-foreground">
            Every customer who leaves feedback gets the same voucher, whatever
            they say. It is never tied to a Google review.
          </p>
        </div>

        <label className="flex items-center gap-3 font-bold">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
            className="size-5 accent-foreground"
          />
          Give a voucher for feedback
        </label>

        <div className="space-y-2">
          <Label htmlFor="voucher-offer" className="font-bold">
            Offer
          </Label>
          <Input
            id="voucher-offer"
            value={values.offer}
            maxLength={offerLimit}
            placeholder="10% off your next visit"
            onChange={(event) => update({ offer: event.target.value })}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="voucher-days" className="font-bold">
              Days until it expires
            </Label>
            <Input
              id="voucher-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              value={values.expiryDays}
              onChange={(event) =>
                update({ expiryDays: event.target.valueAsNumber })
              }
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voucher-cap" className="font-bold">
              Most per month
            </Label>
            <Input
              id="voucher-cap"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              required
              value={values.monthlyCap}
              onChange={(event) =>
                update({ monthlyCap: event.target.valueAsNumber })
              }
              className={inputClass}
            />
          </div>
        </div>

        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saved' ? 'Saved' : 'Save vouchers'}
        </Button>

        {error && (
          <p role="alert" className="font-bold text-destructive">
            {error}
          </p>
        )}
      </form>
    </Card>
  )
}
