'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, Mic, Pause, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { SENTIMENT_STYLE } from '@/lib/sentiment'

export interface Feedback {
  id: string
  customerName: string | null
  /** The spot whose QR code the customer scanned, if any. */
  spot: { id: string; name: string; removed: boolean } | null
  duration: number // seconds
  /** Typed rather than recorded: no audio, no duration. */
  typed: boolean
  /** 'wanted' when the customer left an address for a reply. */
  reply: 'wanted' | 'sent' | null
  transcript: string
  sentiment: 'positive' | 'neutral' | 'negative' | null
  summary: string | null
  themes: Array<string>
  // Set only when the customer spoke a language other than English.
  language: string | null
  translation: string | null
  status: string
  // Presigned, valid for an hour; the list refetches before it expires.
  audioUrl: string | null
  createdAt: string
}

interface FeedbackListProps {
  hasFeedback?: boolean
  initialData?: Array<Feedback>
}

/** Equal apart from case, spacing and end punctuation. */
const sameText = (a: string, b: string | null) => {
  const plain = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[\s.!?…]+$/, '')
      .replace(/\s+/g, ' ')
  return b !== null && plain(a) === plain(b)
}

const formatDuration = (seconds: number): string => {
  if (!seconds) return '0 secs'
  if (seconds < 60) return `${seconds} sec${seconds === 1 ? '' : 's'}`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${mins} min${mins === 1 ? '' : 's'}`
  return `${mins} min${mins === 1 ? '' : 's'} ${secs} sec${secs === 1 ? '' : 's'}`
}

const formatRelativeTime = (isoString: string): string => {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(isoString).toLocaleDateString()
}

export function FeedbackList({
  hasFeedback = true,
  initialData = [],
}: FeedbackListProps) {
  const router = useRouter()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)
  const [filter, setFilter] = useState<
    'all' | 'positive' | 'neutral' | 'negative'
  >('all')
  const [spotFilter, setSpotFilter] = useState('all')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const {
    data: feedbackData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['feedback'],
    queryFn: async () => {
      const response = await fetch('/api/feedback')
      if (!response.ok) throw new Error('Failed to load feedback')
      return (await response.json()) as { feedback: Array<Feedback> }
    },
    enabled: hasFeedback,
    initialData: { feedback: initialData },
    // Audio links last an hour; refresh well before then. Also picks up
    // transcripts that finish while the page is open.
    refetchInterval: 30_000,
  })

  const feedbackList = feedbackData.feedback.map((f) => ({
    ...f,
    date: formatRelativeTime(f.createdAt),
    formattedDuration: f.typed ? null : formatDuration(f.duration),
    displayName: f.customerName || 'Anonymous',
  }))

  const error = queryError ? 'Failed to load feedback' : null

  // By id: an archived spot and a new one can share a name.
  const spotOptions = [
    ...new Map(
      feedbackList.flatMap((f) =>
        f.spot
          ? [
              [
                f.spot.id,
                f.spot.removed ? `${f.spot.name} (removed)` : f.spot.name,
              ],
            ]
          : [],
      ),
    ),
  ].sort(([, a], [, b]) => a.localeCompare(b))
  const filteredFeedback = feedbackList.filter(
    (f) =>
      (filter === 'all' || f.sentiment === filter) &&
      (spotFilter === 'all' || f.spot?.id === spotFilter),
  )

  useEffect(() => () => audioRef.current?.pause(), [])

  // Plays straight from the click, with no await before play(): Safari
  // refuses play() once the click's user activation has been spent.
  const togglePlay = (e: React.MouseEvent, item: Feedback) => {
    e.stopPropagation()
    setPlayError(null)

    const current = audioRef.current
    if (current && playingId === item.id) {
      current.pause()
      setPlayingId(null)
      return
    }
    current?.pause()

    if (!item.audioUrl) {
      setPlayError('This recording has no audio.')
      return
    }
    const audio = new Audio(item.audioUrl)
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => {
      setPlayingId(null)
      setPlayError("This recording couldn't be played. Refresh and try again.")
    }
    audio
      .play()
      .then(() => setPlayingId(item.id))
      .catch(() => {
        setPlayingId(null)
        setPlayError(
          "This recording couldn't be played. Refresh and try again.",
        )
      })
  }

  const handleViewFeedback = (feedbackId: string) => {
    router.push(`/feedback/${feedbackId}`)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  // If we have initialData, we don't need to show loading state
  // The query will use initialData immediately and won't be in loading state

  // Show empty state only if we know there's no feedback
  if (!hasFeedback || feedbackList.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Recent feedback
          </h2>
        </div>
        <EmptyState
          icon={Mic}
          title="No Feedback Yet"
          description="Share your QR code with customers to start collecting voice feedback. Each submission uses one pulse."
        />
      </div>
    )
  }

  // Show empty state if filtered results are empty (but we have feedback)
  if (filteredFeedback.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Recent feedback
          </h2>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="font-bold border-2 border-foreground shadow-brutal-sm"
            >
              All
            </Button>
            <Button
              variant={filter === 'positive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('positive')}
              className="font-bold border-2 border-foreground shadow-brutal-sm"
            >
              Positive
            </Button>
            <Button
              variant={filter === 'neutral' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('neutral')}
              className="font-bold border-2 border-foreground shadow-brutal-sm"
            >
              Neutral
            </Button>
            <Button
              variant={filter === 'negative' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('negative')}
              className="font-bold border-2 border-foreground shadow-brutal-sm"
            >
              Negative
            </Button>
          </div>
        </div>
        <EmptyState
          icon={Mic}
          title="No Feedback Found"
          description={`No ${filter === 'all' ? '' : filter} feedback matches your filter.`}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-extrabold tracking-tight">
          Recent feedback
        </h2>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="font-bold border-2 border-foreground shadow-brutal-sm"
          >
            All
          </Button>
          <Button
            variant={filter === 'positive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('positive')}
            className="font-bold border-2 border-foreground shadow-brutal-sm"
          >
            Positive
          </Button>
          <Button
            variant={filter === 'neutral' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('neutral')}
            className="font-bold border-2 border-foreground shadow-brutal-sm"
          >
            Neutral
          </Button>
          <Button
            variant={filter === 'negative' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('negative')}
            className="font-bold border-2 border-foreground shadow-brutal-sm"
          >
            Negative
          </Button>
        </div>
      </div>

      {spotOptions.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <label htmlFor="spot-filter" className="text-sm font-bold uppercase">
            Spot
          </label>
          <select
            id="spot-filter"
            value={spotFilter}
            onChange={(event) => setSpotFilter(event.target.value)}
            className="border-2 border-foreground bg-card px-3 py-1.5 text-base font-bold"
          >
            <option value="all">All spots</option>
            {spotOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {playError && (
        <p
          role="alert"
          className="mb-4 border-2 border-foreground bg-destructive/10 p-3 font-bold"
        >
          {playError}
        </p>
      )}
      <div className="space-y-4">
        {filteredFeedback.map((item, index) => (
          <Card
            key={item.id}
            // New cards arrive with a short stagger; existing ones keep still.
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            className="group cursor-pointer gap-0 rounded-lg border-2 border-foreground bg-card p-5 shadow-brutal transition-[transform,box-shadow] duration-150 ease-out animate-in fade-in slide-in-from-bottom-2 fill-mode-both hover:-translate-y-0.5 hover:shadow-brutal-lg md:p-6"
            onClick={() => handleViewFeedback(item.id)}
          >
            <div className="flex items-start gap-4">
              {!item.typed ? (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={(e) => togglePlay(e, item)}
                  aria-label={
                    playingId === item.id ? 'Pause recording' : 'Play recording'
                  }
                  className="shrink-0 w-12 h-12 border-2 border-foreground shadow-brutal-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {playingId === item.id ? (
                    <Pause className="w-5 h-5" fill="currentColor" />
                  ) : (
                    <Play className="ml-0.5 w-5 h-5" fill="currentColor" />
                  )}
                </Button>
              ) : (
                <span
                  aria-hidden="true"
                  className="shrink-0 flex w-12 h-12 items-center justify-center border-2 border-foreground"
                >
                  <FileText className="w-5 h-5" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">{item.displayName}</h3>
                      {item.sentiment && (
                        <span
                          className={`rounded-md border-2 border-foreground px-1.5 text-xs font-bold uppercase ${SENTIMENT_STYLE[item.sentiment].className}`}
                        >
                          {SENTIMENT_STYLE[item.sentiment].label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                      <span>{item.date}</span>
                      {item.formattedDuration && (
                        <>
                          <span>•</span>
                          <span>{item.formattedDuration}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewFeedback(item.id)
                      }}
                      aria-label="View transcript"
                      className="border-2 border-transparent hover:border-foreground"
                    >
                      <FileText className="w-5 h-5" />
                    </Button>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                {item.summary && (
                  <p className="mb-3 font-display text-xl font-bold leading-snug">
                    {item.summary}
                  </p>
                )}
                {item.transcript ? (
                  // Short notes often say the same as the summary; skip the repeat.
                  !sameText(
                    item.translation ?? item.transcript,
                    item.summary,
                  ) && (
                    <p className="line-clamp-2 rounded-md border-2 border-foreground bg-secondary p-3 font-medium leading-relaxed">
                      {item.translation ?? item.transcript}
                    </p>
                  )
                ) : (
                  <p className="rounded-md border-2 border-dashed border-foreground p-3 font-medium text-muted-foreground">
                    Transcribing…
                  </p>
                )}
                {(item.themes.length > 0 ||
                  item.language ||
                  item.spot ||
                  item.typed ||
                  item.reply) && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {item.reply === 'wanted' && (
                      <li className="border-2 border-foreground bg-foreground text-background px-2 py-0.5 text-xs font-bold uppercase">
                        Wants a reply
                      </li>
                    )}
                    {item.reply === 'sent' && (
                      <li className="border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase">
                        Replied
                      </li>
                    )}
                    {item.typed && (
                      <li className="border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase">
                        Typed
                      </li>
                    )}
                    {item.spot && (
                      <li className="border-2 border-foreground bg-foreground text-background px-2 py-0.5 text-xs font-bold uppercase">
                        {item.spot.removed
                          ? `${item.spot.name} (removed)`
                          : item.spot.name}
                      </li>
                    )}
                    {item.language && (
                      <li className="border-2 border-foreground bg-accent px-2 py-0.5 text-xs font-bold uppercase">
                        Translated from {item.language}
                      </li>
                    )}
                    {item.themes.map((theme) => (
                      <li
                        key={theme}
                        className="border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase"
                      >
                        {theme}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
