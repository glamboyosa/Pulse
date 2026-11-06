'use client'

import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

import type { DigestContent } from '@/server/digest'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const formatWeek = (weekStart: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${weekStart}T00:00:00Z`))

export function DigestCard({
  digest,
  canWrite,
}: {
  digest: { weekStart: string; content: DigestContent } | null
  /** At least two analysed recordings this week, so a digest can be written. */
  canWrite: boolean
}) {
  const router = useRouter()
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const write = async () => {
    setWriting(true)
    setError(null)
    const response = await fetch('/api/insights/digest', {
      method: 'POST',
    }).catch(() => null)
    setWriting(false)
    if (response?.ok) {
      router.refresh()
      return
    }
    const body: { error?: string } =
      (await response?.json().catch(() => ({}))) ?? {}
    setError(
      response?.status === 429
        ? 'You can rewrite the digest 3 times a day. Try again tomorrow.'
        : (body.error ?? "Couldn't write the digest. Try again in a minute."),
    )
  }

  return (
    <Card className="p-6 md:p-8 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-yellow-200 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles className="size-4" />
            {digest
              ? `Week of ${formatWeek(digest.weekStart)}`
              : 'Weekly digest'}
          </p>
          <h2 className="text-2xl md:text-3xl font-black leading-tight max-w-2xl text-balance">
            {digest?.content.headline ??
              'Every Monday, the three things to fix, in your customers’ words.'}
          </h2>
        </div>
        {canWrite && (
          <Button
            onClick={write}
            disabled={writing}
            variant="outline"
            className="font-bold border-4 border-foreground bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <RefreshCw
              className={`size-4 mr-2 ${writing ? 'animate-spin' : ''}`}
            />
            {writing ? 'WRITING…' : digest ? 'UPDATE NOW' : 'WRITE IT NOW'}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="font-bold text-red-800 mb-4">
          {error}
        </p>
      )}

      {digest && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {digest.content.fixes.map((fix, i) => (
            <div key={i} className="bg-card border-4 border-foreground p-4">
              <p className="text-4xl font-black tabular-nums mb-2">{i + 1}</p>
              <p className="font-black text-lg leading-snug mb-1">
                {fix.title}
              </p>
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                {fix.customers} customer{fix.customers === 1 ? '' : 's'}:{' '}
                {fix.why}
              </p>
              <blockquote className="border-l-4 border-foreground pl-3 text-sm font-semibold italic">
                “{fix.quote}”
              </blockquote>
            </div>
          ))}
          {digest.content.fixes.length === 0 && (
            <p className="font-bold md:col-span-3">
              Nothing to fix this week. Customers had no complaints.
            </p>
          )}
        </div>
      )}

      {digest && digest.content.wins.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-wider mb-2">
            What they loved
          </p>
          <ul className="flex flex-wrap gap-2">
            {digest.content.wins.map((win, i) => (
              <li
                key={i}
                className="bg-card border-2 border-foreground px-3 py-1 text-sm font-bold"
              >
                {win}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
