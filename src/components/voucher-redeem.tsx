'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { VoucherState } from '@/server/vouchers'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** A voucher as the API returns it: dates arrive as strings over JSON. */
export type StaffVoucher = {
  code: string
  offer: string
  expiresAt: string | Date
  redeemedAt: string | Date | null
  state: VoucherState
}

// Expiry is the end of a day in UTC, so it shows as that date, as the
// customer sees it.
const formatExpiry = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const STATE_LABELS: Record<VoucherState, string> = {
  valid: 'Valid',
  redeemed: 'Already redeemed',
  expired: 'Expired',
}

/** Staff type or scan a code, check it, and redeem it. */
export function VoucherRedeem({
  initialCode,
  initialVoucher,
}: {
  initialCode: string
  initialVoucher: StaffVoucher | null
}) {
  const router = useRouter()
  const [code, setCode] = useState(initialCode)
  const [voucher, setVoucher] = useState(initialVoucher)
  const [justRedeemed, setJustRedeemed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    initialCode && !initialVoucher ? 'No voucher with that code.' : null,
  )

  const call = async (method: 'GET' | 'POST', path: string) => {
    setBusy(true)
    setError(null)
    const response = await fetch(path, { method }).catch(() => null)
    setBusy(false)
    if (!response) {
      setError('Check your connection and try again.')
      return null
    }
    const body = (await response.json().catch(() => ({}))) as {
      voucher?: StaffVoucher
      error?: string
    }
    if (response.status === 404) setError('No voucher with that code.')
    else if (!body.voucher) setError('Something went wrong. Try again.')
    setVoucher(body.voucher ?? null)
    return response.ok
  }

  const check = async (event: React.FormEvent) => {
    event.preventDefault()
    setJustRedeemed(false)
    await call('GET', `/api/vouchers/${encodeURIComponent(code.trim())}`)
  }

  const redeem = async () => {
    if (!voucher) return
    const ok = await call(
      'POST',
      `/api/vouchers/${encodeURIComponent(voucher.code)}/redeem`,
    )
    setJustRedeemed(Boolean(ok))
    // Updates this month's figures in the heading.
    if (ok) router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-2 border-foreground shadow-brutal bg-card">
        <form onSubmit={check} className="space-y-2">
          <Label htmlFor="voucher-code" className="font-bold">
            Voucher code
          </Label>
          <div className="flex gap-3">
            <Input
              id="voucher-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="K7PQ4X"
              className="h-12 border-2 border-foreground font-display text-2xl font-extrabold uppercase tracking-[0.2em]"
            />
            <Button
              type="submit"
              disabled={busy || !code.trim()}
              className="h-12"
            >
              Check
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="mt-3 font-bold text-destructive">
            {error}
          </p>
        )}
      </Card>

      {voucher && (
        <Card
          aria-label="Voucher"
          className="p-6 border-2 border-foreground shadow-brutal bg-card space-y-3"
        >
          <p
            role="status"
            className={`text-2xl font-black ${
              voucher.state === 'valid' || justRedeemed
                ? ''
                : 'text-destructive'
            }`}
          >
            {justRedeemed ? 'Redeemed' : STATE_LABELS[voucher.state]}
          </p>
          <p className="text-xl font-bold">{voucher.offer}</p>
          <p className="font-display text-lg font-extrabold tracking-[0.2em]">
            {voucher.code}
          </p>
          <p className="text-sm font-semibold text-muted-foreground">
            {voucher.redeemedAt
              ? `Redeemed ${formatDate(voucher.redeemedAt)}`
              : `${voucher.state === 'expired' ? 'Expired' : 'Valid until'} ${formatExpiry(voucher.expiresAt)}`}
          </p>
          {voucher.state === 'valid' && (
            <Button
              onClick={redeem}
              disabled={busy}
              className="h-14 w-full text-lg font-bold"
            >
              Redeem
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
