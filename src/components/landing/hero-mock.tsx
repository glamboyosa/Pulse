'use client'

import { useEffect, useRef, useState } from 'react'

import type { Sentiment } from '@/lib/sentiment'
import { JellyWave, usePrefersReducedMotion } from '@/components/jelly-wave'
import { SENTIMENT_STYLE } from '@/lib/sentiment'

type Example = {
  name: string
  language: string
  spot: string
  length: string
  sentiment: Sentiment
  summary: string
  /** What they said, in English. Marked as a translation unless spoken in English. */
  quote: string
  themes: Array<string>
}

const EXAMPLES: Array<Example> = [
  {
    name: 'Nene',
    language: 'Nigerian Pidgin',
    spot: 'Patio',
    length: '0:24',
    sentiment: 'negative',
    summary: 'Great food, but the patio is too hot. Fix the fans.',
    quote:
      'Your food is really tasty, but this place is as hot as an oven. Please fix the fans.',
    themes: ['Atmosphere'],
  },
  {
    name: 'Toke',
    language: 'Yoruba',
    spot: 'Table 4',
    length: '0:38',
    sentiment: 'negative',
    summary: 'Loved the jollof rice, but waited 40 minutes for food.',
    quote: 'The food was very good, but we waited a long time before it came.',
    themes: ['Food quality', 'Wait time'],
  },
  {
    name: 'Oliver',
    language: 'English (UK)',
    spot: 'Bar',
    length: '0:51',
    sentiment: 'positive',
    summary: 'Brilliant service from Ama at the bar. Will be back.',
    quote:
      'Ama at the bar was brilliant, honestly the best service we’ve had in ages.',
    themes: ['Staff friendliness'],
  },
  {
    name: 'Maya',
    language: 'English (US)',
    spot: 'Window seat',
    length: '0:33',
    sentiment: 'neutral',
    summary: 'Burger was good, but the fries arrived cold.',
    quote:
      'The burger was really good, the fries were cold by the time they got to us though.',
    themes: ['Food quality'],
  },
  {
    name: 'Inês',
    language: 'Portuguese',
    spot: 'Table 9',
    length: '0:29',
    sentiment: 'positive',
    summary: 'Fast service and excellent food. Coming back.',
    quote:
      'The service was quick and the food was excellent. I’ll definitely be back.',
    themes: ['Service', 'Food quality'],
  },
]

/** Bar heights for the card's waveform, so it reads as a voice note. */
const WAVE = [
  6, 14, 22, 12, 28, 18, 34, 24, 16, 30, 20, 10, 26, 32, 14, 22, 8, 18, 28, 12,
  24, 16, 30, 10, 20, 26, 12, 18,
]
// The example "plays" for this long; at rest it shows this much played.
const DEMO_MS = 3100
const RESTING = 11 / WAVE.length

const isEnglish = (language: string) => language.startsWith('English')

/**
 * A code-built picture of what an owner sees for one piece of feedback. The
 * tabs below switch between customers. Its voice note plays itself once when
 * it scrolls into view, and again for each customer picked.
 */
export function HeroMock() {
  const [active, setActive] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const example = EXAMPLES[active]
  const reduced = usePrefersReducedMotion()
  const [playRun, setPlayRun] = useState(0)
  const startedAt = useRef(0)
  const panel = useRef<HTMLDivElement>(null)

  const play = () => {
    startedAt.current = performance.now()
    setPlayRun((run) => run + 1)
  }
  const playing = playRun > 0
  const getProgress = () =>
    playing
      ? Math.min(1, (performance.now() - startedAt.current) / DEMO_MS)
      : RESTING

  useEffect(() => {
    if (playRun === 0) return
    const done = setTimeout(() => setPlayRun(0), DEMO_MS)
    return () => clearTimeout(done)
  }, [playRun])

  // Plays itself once, when the card is mostly on screen.
  useEffect(() => {
    const element = panel.current
    if (!element || reduced) return
    let start: ReturnType<typeof setTimeout> | undefined
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        seen.disconnect()
        start = setTimeout(play, 350)
      },
      { threshold: 0.7 },
    )
    seen.observe(element)
    return () => {
      seen.disconnect()
      clearTimeout(start)
    }
  }, [reduced])

  const choose = (index: number) => {
    setActive(index)
    if (!reduced) play()
  }

  const select = (index: number) => {
    const next = (index + EXAMPLES.length) % EXAMPLES.length
    choose(next)
    tabs.current[next]?.focus()
  }

  return (
    <div>
      <div
        ref={panel}
        id="hero-example"
        role="tabpanel"
        aria-labelledby={`hero-tab-${active}`}
        tabIndex={0}
      >
        {/* Re-keyed per example, so each one slides in. */}
        <div
          key={example.name}
          className="rounded-lg border-2 border-foreground bg-card p-5 shadow-brutal-lg animate-in fade-in slide-in-from-right-3 duration-200 ease-out md:p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-xl font-bold">{example.name}</p>
              <p className="text-sm font-semibold text-muted-foreground">
                {example.spot} · 2 min ago · {example.length}
              </p>
            </div>
            <span
              className={`rounded-md border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase ${SENTIMENT_STYLE[example.sentiment].className}`}
            >
              {SENTIMENT_STYLE[example.sentiment].label}
            </span>
          </div>

          <div className="mb-4">
            <JellyWave
              heights={WAVE}
              getProgress={getProgress}
              restingProgress={RESTING}
              playing={playing}
              motion={!reduced}
            >
              {/* The demo has no sound, so it's left out for screen readers. */}
              <button
                type="button"
                onClick={play}
                tabIndex={-1}
                aria-hidden="true"
                className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-foreground bg-accent transition-transform duration-150 ease-out before:absolute before:-inset-1.5 active:scale-[0.96]"
              >
                <svg
                  viewBox="0 0 10 12"
                  className="ml-0.5 size-3"
                  aria-hidden="true"
                >
                  <path d="M0 0l10 6-10 6z" fill="currentColor" />
                </svg>
              </button>
            </JellyWave>
          </div>

          <p className="mb-3 font-display text-xl font-bold leading-snug md:text-2xl">
            {example.summary}
          </p>
          <p className="mb-4 border-l-4 border-foreground pl-3 text-sm font-semibold text-muted-foreground">
            <span className="font-bold text-foreground">
              {isEnglish(example.language)
                ? 'In their words:'
                : `Translated from ${example.language}:`}
            </span>{' '}
            “{example.quote}”
          </p>
          <ul className="flex flex-wrap gap-2">
            {example.themes.map((theme) => (
              <li
                key={theme}
                className="rounded-md border-2 border-foreground px-2 py-0.5 text-xs font-bold uppercase"
              >
                {theme}
              </li>
            ))}
          </ul>
        </div>

        <div
          key={`${example.name}-note`}
          className="relative -mt-3 mr-2 ml-auto w-64 rotate-[2deg] rounded-lg border-2 border-foreground bg-accent p-4 shadow-brutal animate-in fade-in zoom-in-95 duration-200 ease-out xl:-mr-6"
        >
          {example.sentiment === 'negative' ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wider">
                Email · just now
              </p>
              <p className="mt-1 font-display text-lg font-bold leading-tight">
                Unhappy customer from {example.name}
              </p>
              <p className="mt-1 text-sm font-semibold">
                Reply while they still remember the visit.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider">
                Email · just now
              </p>
              <p className="mt-1 font-display text-lg font-bold leading-tight">
                New feedback from {example.name}
              </p>
              <p className="mt-1 text-sm font-semibold">
                It counts towards Monday’s digest too.
              </p>
            </>
          )}
        </div>
      </div>

      <p className="mt-8 mb-3 text-sm font-bold">
        Hear another customer <span aria-hidden="true">→</span>
      </p>
      <div
        role="tablist"
        aria-label="Example customers"
        className="flex flex-wrap gap-2"
      >
        {EXAMPLES.map((item, i) => (
          <button
            key={item.name}
            ref={(element) => {
              tabs.current[i] = element
            }}
            id={`hero-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls="hero-example"
            tabIndex={i === active ? 0 : -1}
            onClick={() => choose(i)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') select(active + 1)
              if (event.key === 'ArrowLeft') select(active - 1)
              if (event.key === 'Home') select(0)
              if (event.key === 'End') select(EXAMPLES.length - 1)
            }}
            className={`relative min-h-11 cursor-pointer rounded-md before:absolute before:-inset-0.5 border-2 border-foreground px-3 py-1.5 text-sm font-bold md:min-h-9 transition-[transform,box-shadow] duration-150 ease-out ${
              i === active
                ? 'bg-foreground text-background'
                : 'bg-card shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:before:translate-y-0.5 active:before:-translate-x-[2px] active:before:-translate-y-[2px]'
            }`}
          >
            {item.name}
            <span className="font-semibold opacity-70"> · {item.language}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
