'use client'

import { ArrowDownRight, ArrowUpRight, Minus, Pause, Play } from 'lucide-react'

import type { Insights, ThemeTrack } from '@/server/insights'
import type { DigestContent } from '@/server/digest'
import { NowPlaying, useThemePlaylist } from '@/components/theme-player'
import { DigestCard } from '@/components/digest-card'
import { Card } from '@/components/ui/card'

const playButtonClass =
  'relative flex items-center gap-1.5 text-sm font-bold underline underline-offset-4 transition-transform duration-150 ease-out before:absolute before:-inset-x-2 before:-inset-y-3 active:scale-[0.96]'

const cardClass = 'p-6 border-2 border-foreground shadow-brutal bg-card'

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100)

/** Up, down or flat against the period before. `label` is read out; omit it when nearby text already says it. */
const Trend = ({
  now,
  before,
  label,
}: {
  now: number
  before: number
  label?: string
}) => {
  const Icon =
    now === before ? Minus : now > before ? ArrowUpRight : ArrowDownRight
  return label ? (
    <Icon className="size-4" role="img" aria-label={label} />
  ) : (
    <Icon className="size-4" aria-hidden="true" />
  )
}

export function InsightsPanel({
  insights,
  tracks,
  digest,
  canWriteDigest,
}: {
  insights: Insights
  /** Each theme's recordings, for "Play all". */
  tracks: Record<string, Array<ThemeTrack>>
  digest: { weekStart: string; content: DigestContent } | null
  canWriteDigest: boolean
}) {
  const playlist = useThemePlaylist()
  const { sentiment, total, themes } = insights
  const negativeShare = percent(sentiment.negative, total)
  const previousNegativeShare = percent(
    insights.previousNegative,
    insights.previousTotal,
  )
  const segments = [
    { label: 'Positive', count: sentiment.positive, className: 'bg-positive' },
    { label: 'Neutral', count: sentiment.neutral, className: 'bg-neutral' },
    { label: 'Negative', count: sentiment.negative, className: 'bg-negative' },
  ]
  const busiestTheme = Math.max(1, ...themes.map((t) => t.mentions))

  return (
    <div className="space-y-8">
      <DigestCard digest={digest} canWrite={canWriteDigest} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className={cardClass}>
          <h2 className="text-2xl font-black mb-1">How customers feel</h2>
          <p className="text-sm font-semibold text-muted-foreground mb-6">
            {insights.days === null ? 'All time' : `Last ${insights.days} days`}{' '}
            · {total} recording{total === 1 ? '' : 's'}
          </p>
          {total === 0 ? (
            <p className="font-semibold text-muted-foreground">
              Nothing yet. Share your QR code and this fills in as feedback
              arrives.
            </p>
          ) : (
            <>
              <div
                className="flex h-10 border-2 border-foreground overflow-hidden"
                role="img"
                aria-label={segments
                  .map((s) => `${s.label} ${percent(s.count, total)}%`)
                  .join(', ')}
              >
                {segments.map(
                  (s) =>
                    s.count > 0 && (
                      <div
                        key={s.label}
                        className={`${s.className} border-r-2 border-foreground last:border-r-0`}
                        style={{ width: `${percent(s.count, total)}%` }}
                      />
                    ),
                )}
              </div>
              <dl className="grid grid-cols-3 gap-3 mt-4">
                {segments.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs font-bold uppercase text-muted-foreground">
                      {s.label}
                    </dt>
                    <dd className="text-2xl font-black tabular-nums">
                      {percent(s.count, total)}%
                    </dd>
                  </div>
                ))}
              </dl>
              {insights.previousTotal > 0 && (
                <p className="mt-4 flex items-center gap-2 text-sm font-bold">
                  <Trend now={negativeShare} before={previousNegativeShare} />
                  {negativeShare === previousNegativeShare
                    ? 'Same share of unhappy customers as the 30 days before'
                    : `Unhappy customers ${negativeShare > previousNegativeShare ? 'up' : 'down'} from ${previousNegativeShare}% the 30 days before`}
                </p>
              )}
            </>
          )}
        </Card>

        <Card className={cardClass}>
          <h2 className="text-2xl font-black mb-1">What they talk about</h2>
          <p className="text-sm font-semibold text-muted-foreground mb-6">
            Most complained about first
          </p>
          {themes.length === 0 ? (
            <p className="font-semibold text-muted-foreground">
              Themes appear once a few recordings are in.
            </p>
          ) : (
            <ul className="space-y-4">
              {themes.map((theme) => (
                <li key={theme.theme}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="font-black uppercase">{theme.theme}</span>
                    <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
                      {theme.mentions}
                      {insights.days !== null && (
                        <Trend
                          now={theme.mentions}
                          before={theme.previousMentions}
                          label={`${theme.previousMentions} the 30 days before`}
                        />
                      )}
                    </span>
                  </div>
                  <div className="flex h-4 border-2 border-foreground bg-secondary">
                    <div
                      className="bg-negative"
                      style={{
                        width: `${(theme.negative / busiestTheme) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-foreground/20"
                      style={{
                        width: `${((theme.mentions - theme.negative) / busiestTheme) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    {theme.negative > 0 ? (
                      <p className="text-xs font-bold text-destructive">
                        {theme.negative} unhappy
                      </p>
                    ) : (
                      <span />
                    )}
                    {tracks[theme.theme].length > 0 &&
                      (playlist.playing?.theme === theme.theme ? (
                        // The theme that's playing pauses and resumes in place.
                        <button
                          type="button"
                          data-play-theme={theme.theme}
                          onClick={playlist.togglePause}
                          aria-label={`${playlist.playing.paused ? 'Resume' : 'Pause'} ${theme.theme}`}
                          className={playButtonClass}
                        >
                          {playlist.playing.paused ? (
                            <Play
                              aria-hidden="true"
                              className="size-3.5"
                              fill="currentColor"
                            />
                          ) : (
                            <Pause
                              aria-hidden="true"
                              className="size-3.5"
                              fill="currentColor"
                            />
                          )}
                          {playlist.playing.paused ? 'Resume' : 'Pause'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-play-theme={theme.theme}
                          onClick={() =>
                            playlist.start(theme.theme, tracks[theme.theme])
                          }
                          aria-label={
                            tracks[theme.theme].length === 1
                              ? `Play the ${theme.theme} recording`
                              : `Play all ${tracks[theme.theme].length} ${theme.theme} recordings`
                          }
                          className={playButtonClass}
                        >
                          <Play
                            aria-hidden="true"
                            className="size-3.5"
                            fill="currentColor"
                          />
                          {tracks[theme.theme].length === 1
                            ? 'Play'
                            : `Play all ${tracks[theme.theme].length}`}
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <NowPlaying playlist={playlist} />
        </Card>
      </div>
    </div>
  )
}
