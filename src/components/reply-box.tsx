'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const MAX = 1000

/** The owner's one reply to a customer who left an address. */
export function ReplyBox({
  feedbackId,
  customerName,
  reply,
}: {
  feedbackId: string
  customerName: string | null
  reply:
    | { state: 'none' }
    | { state: 'wanted' }
    /** `sentOn` is formatted on the server, e.g. "6 November". */
    | { state: 'sent'; text: string; sentOn: string }
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const who = customerName ?? 'this customer'

  if (reply.state === 'none') {
    return (
      <section aria-live="polite">
        <p className="border-2 border-dashed border-foreground p-4 font-semibold text-muted-foreground">
          {customerName ?? 'This customer'} didn&apos;t leave a way to reply.
        </p>
      </section>
    )
  }

  if (reply.state === 'sent') {
    return (
      // The same live region as the form, so the switch to "sent" is announced.
      <section
        aria-live="polite"
        className="border-2 border-foreground bg-card p-6"
      >
        <h2 className="mb-1 text-xl font-black">Your reply</h2>
        <p className="mb-3 text-sm font-semibold text-muted-foreground">
          Sent on {reply.sentOn}. If they answer, it comes to your email.
        </p>
        <p className="whitespace-pre-wrap font-semibold">{reply.text}</p>
      </section>
    )
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    setSending(true)
    setError(null)
    const response = await fetch(`/api/feedback/${feedbackId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }).catch(() => null)
    setSending(false)
    if (response?.ok) {
      // So the dashboard's "Wants a reply" tag updates too.
      queryClient.removeQueries({ queryKey: ['feedback'] })
      router.refresh()
      return
    }
    const body = ((await response?.json().catch(() => ({}))) ?? {}) as {
      error?: string
    }
    setError(body.error ?? "The reply didn't send. Check your connection.")
  }

  return (
    <section aria-live="polite">
      <form
        onSubmit={send}
        className="space-y-3 border-2 border-foreground bg-card p-6"
      >
        <Label htmlFor="reply" className="text-xl font-black">
          REPLY TO {who.toUpperCase()}
        </Label>
        <p
          id="reply-hint"
          className="text-sm font-semibold text-muted-foreground"
        >
          They asked for a reply. Pulse emails it from your business name and
          keeps their address private unless they write back. You can reply
          once.
        </p>
        <textarea
          id="reply"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX}
          rows={5}
          aria-describedby={error ? 'reply-hint reply-error' : 'reply-hint'}
          aria-invalid={error ? true : undefined}
          placeholder="Thanks for telling us. We've…"
          className="w-full border-2 border-foreground bg-background p-3 text-base font-semibold"
        />
        {error && (
          <p id="reply-error" className="font-bold text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={sending || !message.trim()}
          className="border-2 border-foreground font-bold shadow-brutal-sm"
        >
          <Send className="mr-2 size-4" />
          {sending ? 'SENDING…' : 'SEND REPLY'}
        </Button>
      </form>
    </section>
  )
}
