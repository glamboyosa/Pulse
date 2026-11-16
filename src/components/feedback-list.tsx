'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, Languages, Mic, Pause, Play } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  /** Left through the website widget: the page it was on (path only). */
  widgetPage: string | null
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

const SENTIMENT_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
] as const

/**
 * The customer's words, and the English under them when they spoke another
 * language. Two lines each, with "Show more" only when something is cut off.
 */
const NoteText = ({
  original,
  english,
}: {
  original: string
  english: string | null
}) => {
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = box.current
    if (!element || expanded) return
    const measure = () =>
      setClipped(
        [...element.querySelectorAll('[data-clamp]')].some(
          (line) => line.scrollHeight > line.clientHeight + 1,
        ),
      )
    measure()
    // Text can rewrap once the web font swaps in, without the box resizing.
    void document.fonts.ready.then(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, original, english])

  const clamp = expanded ? '' : 'line-clamp-2'
  return (
    <div
      ref={box}
      className="rounded-md border-2 border-foreground bg-secondary p-3 leading-relaxed"
    >
      <p data-clamp className={`font-medium ${clamp}`}>
        {original}
      </p>
      {english && (
        // The customer's own words with the English right under them: the
        // "any language" promise, at a glance.
        <p className="mt-1.5 flex gap-2 text-muted-foreground">
          <Languages aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span data-clamp className={clamp}>
            <span className="sr-only">In English: </span>
            {english}
          </span>
        </p>
      )}
      {(clipped || expanded) && (
        <button
          type="button"
          onClick={(event) => {
            // The card opens the note; this only expands the text.
            event.stopPropagation()
            setExpanded((open) => !open)
          }}
          className="relative mt-2 text-sm font-bold underline underline-offset-4 transition-transform duration-150 ease-out before:absolute before:-inset-x-2 before:-top-2 before:-bottom-3 active:scale-[0.96]"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export function FeedbackList({
  hasFeedback = true,
  initialData = [],
}: FeedbackListProps) {
  const router = useRouter()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playError, setPlayError] = useState<string | null>(null)
  const [filter, setFilter] =
    useState<(typeof SENTIMENT_FILTERS)[number]['value']>('all')
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
  // A place whose last note went away drops out of the list; show everything.
  const spotLabel = spotOptions.find(([id]) => id === spotFilter)?.[1]
  const activeSpot = spotLabel ? spotFilter : 'all'
  const filteredFeedback = feedbackList.filter(
    (f) =>
      (filter === 'all' || f.sentiment === filter) &&
      (activeSpot === 'all' || f.spot?.id === activeSpot),
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

  // One set of filters for both the list and its empty state, so a filter
  // that matches nothing can still be changed back.
  const filters = (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-extrabold tracking-tight">
          Recent feedback
        </h2>
        <div
          role="group"
          aria-label="Sentiment"
          className="flex flex-wrap gap-2"
        >
          {SENTIMENT_FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              variant={filter === value ? 'default' : 'outline'}
              size="sm"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className="font-bold border-2 border-foreground shadow-brutal-sm"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {spotOptions.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <label
            htmlFor="spot-filter"
            className="shrink-0 text-sm font-bold whitespace-nowrap uppercase"
          >
            Left at
          </label>
          <Select value={activeSpot} onValueChange={setSpotFilter}>
            <SelectTrigger id="spot-filter">
              {/* Given directly, so the server-rendered page shows it too. */}
              <SelectValue>{spotLabel ?? 'All branches & tables'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches &amp; tables</SelectItem>
              {spotOptions.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <p role="status" className="sr-only">
        {filteredFeedback.length === 1
          ? '1 note'
          : `${filteredFeedback.length} notes`}
      </p>
    </>
  )

  if (filteredFeedback.length === 0) {
    return (
      <div>
        {filters}
        <EmptyState
          icon={Mic}
          title="No Feedback Found"
          description="No feedback matches your filters."
        />
      </div>
    )
  }

  return (
    <div>
      {filters}

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
            className="group cursor-pointer gap-0 rounded-lg border-2 border-foreground bg-card p-5 shadow-brutal transition-[transform,box-shadow] duration-150 ease-out animate-in fade-in slide-in-from-bottom-2 fill-mode-both hover:-translate-y-0.5 hover:shadow-brutal-lg md:p-6 relative before:absolute before:-inset-0.5 before:-z-10 hover:before:translate-y-0.5"
            onClick={() => handleViewFeedback(item.id)}
          >
            <div className="flex items-start gap-4">
              {!item.typed ? (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={(e) => togglePlay(e, item)}
                  aria-label={`${
                    playingId === item.id ? 'Pause' : 'Play'
                  } recording from ${item.displayName}`}
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
                  <div className="min-w-0 flex-1">
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
                    {/* Each dot travels with the item after it, so a wrapped line never ends on one. */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted-foreground">
                      <span className="whitespace-nowrap">{item.date}</span>
                      {item.formattedDuration && (
                        <span className="whitespace-nowrap">
                          • {item.formattedDuration}
                        </span>
                      )}
                      {item.language && <span>• {item.language}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* The keyboard and screen reader way in; the card's own
                        click is a larger target for the pointer. */}
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="border-2 border-transparent hover:border-foreground"
                    >
                      <Link
                        href={`/feedback/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View transcript from ${item.displayName}`}
                      >
                        <FileText className="w-5 h-5" />
                      </Link>
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
                  // Short notes often say the same as the summary; skip the
                  // repeat, unless it's in another language.
                  (item.translation ||
                    !sameText(item.transcript, item.summary)) && (
                    <NoteText
                      original={item.transcript}
                      english={
                        // The summary above may already say it in English.
                        item.translation &&
                        !sameText(item.translation, item.summary)
                          ? item.translation
                          : null
                      }
                    />
                  )
                ) : (
                  <p className="rounded-md border-2 border-dashed border-foreground p-3 font-medium text-muted-foreground">
                    {item.status === 'processing'
                      ? 'Transcribing…'
                      : `No transcript for this one.${item.audioUrl ? ' Play it to listen.' : ''}`}
                  </p>
                )}
                {(item.themes.length > 0 ||
                  item.spot ||
                  item.typed ||
                  item.widgetPage !== null ||
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
                    {item.widgetPage !== null && (
                      <li className="max-w-full break-all border-2 border-foreground bg-foreground text-background px-2 py-0.5 text-xs font-bold normal-case">
                        Website{item.widgetPage ? ` · ${item.widgetPage}` : ''}
                      </li>
                    )}
                    {item.spot && (
                      <li className="border-2 border-foreground bg-foreground text-background px-2 py-0.5 text-xs font-bold uppercase">
                        {item.spot.removed
                          ? `${item.spot.name} (removed)`
                          : item.spot.name}
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
