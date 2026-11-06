import Link from 'next/link'

interface DashboardStatsProps {
  pulsesRemaining: number
  totalFeedback: number
  avgDuration: number // in seconds
  thisWeekCount: number
}

const LOW_PULSES = 4

const formatDuration = (seconds: number) =>
  seconds > 0
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
    : '–'

/** One compact row of figures; the feedback below is the main content. */
export function DashboardStats({
  pulsesRemaining,
  totalFeedback,
  avgDuration,
  thisWeekCount,
}: DashboardStatsProps) {
  const low = pulsesRemaining <= LOW_PULSES
  const cell = 'flex flex-col gap-0.5 p-4 md:p-5'
  const label =
    'text-xs font-bold uppercase tracking-wider text-muted-foreground'
  const value = 'font-display text-3xl font-extrabold tabular-nums md:text-4xl'
  const note = 'text-xs font-semibold text-muted-foreground md:text-sm'

  return (
    <dl className="grid grid-cols-3 divide-x-2 divide-foreground overflow-hidden rounded-lg border-2 border-foreground bg-card shadow-brutal">
      <div className={cell}>
        <dt className={label}>Feedback</dt>
        <dd className={value}>{totalFeedback}</dd>
        <dd className={note}>
          {thisWeekCount > 0 ? `+${thisWeekCount} this week` : 'None this week'}
        </dd>
      </div>
      <div className={`${cell} ${low ? 'bg-accent' : ''}`}>
        <dt className={label}>Pulses left</dt>
        <dd className={value}>{pulsesRemaining}</dd>
        <dd className={note}>
          <Link href="/buy-pulses" className="underline underline-offset-2">
            {low ? 'Top up now' : 'Buy more'}
          </Link>
        </dd>
      </div>
      <div className={cell}>
        <dt className={label}>Avg. length</dt>
        <dd className={value}>{formatDuration(avgDuration)}</dd>
        <dd className={note}>per voice note</dd>
      </div>
    </dl>
  )
}
