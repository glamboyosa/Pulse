'use client'

import { useEffect, useState } from 'react'
import QRCodeSVG from 'react-qr-code'

type Claim =
  | { status: 'pending' }
  | {
      status: 'issued'
      voucher: { code: string; offer: string; expiresAt: string }
    }
  | {
      status: 'none'
      reason: 'too-short' | 'failed' | 'already' | 'unavailable'
    }

const POLL_MS = 1500
// Transcription and analysis usually take a few seconds.
const GIVE_UP_MS = 45_000

const NONE_MESSAGES = {
  'too-short':
    'Vouchers are for notes with a little more in them. Thanks for sending this one all the same.',
  failed:
    "We couldn't process your note just now, so we can't give a voucher for it. Your feedback still reached the team.",
  already: 'You already have a voucher from us. Thanks for coming back!',
  unavailable: 'Vouchers have run out for now.',
}

/**
 * The voucher for a note just sent. The server issues it once the note is
 * transcribed, so this asks until it has an answer.
 */
export function CustomerVoucher({ feedbackId }: { feedbackId: string }) {
  const [claim, setClaim] = useState<Claim>({ status: 'pending' })
  const [timedOut, setTimedOut] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const stopped = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const startedAt = Date.now()
    const ask = async () => {
      const response = await fetch(`/api/feedback/${feedbackId}/voucher`, {
        cache: 'no-store',
        signal: stopped.signal,
      }).catch(() => null)
      const result = response?.ok
        ? ((await response.json().catch(() => null)) as Claim | null)
        : null
      if (stopped.signal.aborted) return
      if (result && result.status !== 'pending') {
        setClaim(result)
      } else if (Date.now() - startedAt > GIVE_UP_MS) {
        setTimedOut(true)
      } else {
        timer = setTimeout(ask, POLL_MS)
      }
    }
    void ask()
    return () => {
      stopped.abort()
      clearTimeout(timer)
    }
  }, [feedbackId, attempt])

  if (claim.status === 'none') {
    return (
      <p className="mt-6 font-semibold text-muted-foreground">
        {NONE_MESSAGES[claim.reason]}
      </p>
    )
  }

  if (claim.status === 'pending') {
    return (
      <div className="mt-6 border-2 border-dashed border-foreground p-4">
        {timedOut ? (
          <>
            <p className="font-bold">Your voucher is taking a while.</p>
            <button
              type="button"
              onClick={() => {
                setTimedOut(false)
                setAttempt((n) => n + 1)
              }}
              className="mt-2 font-bold underline underline-offset-4"
            >
              Try again
            </button>
          </>
        ) : (
          <p className="font-bold" aria-live="polite">
            Getting your voucher…
          </p>
        )}
      </div>
    )
  }

  const { voucher } = claim
  const redeemUrl = `${window.location.origin}/dashboard/vouchers?code=${voucher.code}`
  return (
    <section
      aria-label="Your voucher"
      className="mt-6 border-2 border-dashed border-foreground p-5"
    >
      <p className="text-xl font-black text-balance">{voucher.offer}</p>
      <div className="mx-auto mt-4 w-40 bg-white p-2">
        <QRCodeSVG
          value={redeemUrl}
          size={144}
          title={`Voucher QR code ${voucher.code}`}
          className="h-auto w-full"
        />
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-[0.2em] tabular-nums">
        {voucher.code}
      </p>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">
        Show this to staff. Valid until{' '}
        {new Date(voucher.expiresAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
        .
      </p>
    </section>
  )
}
