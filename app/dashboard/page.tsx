import Link from 'next/link'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

import { getCurrentUser } from '../actions/auth'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardStats } from '@/components/dashboard-stats'
import { FeedbackList } from '@/components/feedback-list'
import { QRCodeSection } from '@/components/qr-code-section'
import { InsightsPanel } from '@/components/insights-panel'
import {
  MIN_FEEDBACK_FOR_DIGEST,
  countReadyFeedback,
  currentWeek,
  latestDigest,
} from '@/server/digest'
import { retryStuckAnalyses } from '@/server/feedback-submission'
import { getFeedbackStats, listFeedback } from '@/server/feedback-queries'
import { getInsights, themeTracks } from '@/server/insights'
import { listSpots } from '@/server/spots'
import { SpotsSection } from '@/components/spots-section'
import { VouchersCard } from '@/components/vouchers-card'
import { monthlyVoucherStats, voucherSettings } from '@/server/vouchers'

const tabClass = (active: boolean) =>
  `relative rounded-md border-2 border-foreground px-5 py-2 before:absolute before:-inset-0.5 font-bold transition-[transform,box-shadow] duration-150 ${
    active
      ? 'bg-foreground text-background'
      : 'bg-card shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal hover:before:translate-y-0.5'
  }`

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  after(() => retryStuckAnalyses(user.id))

  const showInsights = (await searchParams).tab === 'insights'
  const stats = await getFeedbackStats(user.id)
  const hasFeedback = stats.totalFeedback > 0

  const [insights, digest, canWriteDigest, formattedFeedback] = showInsights
    ? await Promise.all([
        getInsights(user.id),
        latestDigest(user.id),
        countReadyFeedback(user.id, currentWeek()).then(
          (n) => n >= MIN_FEEDBACK_FOR_DIGEST,
        ),
        [],
      ])
    : [null, null, false, await listFeedback(user.id)]
  // Each theme's recordings, for "Play all", from the same period.
  const tracks = insights
    ? await themeTracks(
        user.id,
        insights.themes.map((theme) => theme.theme),
        insights.days,
      )
    : {}
  const [spots, voucherStats, vouchersOn] = showInsights
    ? [[], null, false]
    : await Promise.all([
        listSpots(user.id),
        monthlyVoucherStats(user.id),
        voucherSettings(user.id).then((settings) => settings.enabled),
      ])

  return (
    <div className="min-h-screen bg-secondary">
      <DashboardHeader user={user} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Welcome back
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            {user.businessName ?? user.name}
          </h1>
        </div>
        {user.freePulsesWithheld && user.pulsesRemaining === 0 && (
          // A real owner caught by the free-pulse checks gets a way out.
          <p className="mb-6 rounded-lg border-2 border-foreground bg-card p-4 font-semibold">
            {user.freePulsesWithheld === 'inbox'
              ? 'This account started without free pulses because this email already had them on another Pulse account.'
              : 'This account started without free pulses because several new accounts were set up from this connection recently.'}{' '}
            If that&apos;s not right, email{' '}
            <a
              href="mailto:support@pulseapp.click?subject=Free%20pulses"
              className="underline underline-offset-4"
            >
              support@pulseapp.click
            </a>{' '}
            and we&apos;ll sort it out.
          </p>
        )}
        <DashboardStats
          pulsesRemaining={user.pulsesRemaining || 0}
          totalFeedback={stats.totalFeedback}
          avgDuration={stats.avgDuration}
          thisWeekCount={stats.thisWeekCount}
        />
        <nav aria-label="Dashboard" className="flex gap-3 mt-8">
          <Link
            href="/dashboard"
            aria-current={showInsights ? undefined : 'page'}
            className={tabClass(!showInsights)}
          >
            Feedback
          </Link>
          <Link
            href="/dashboard?tab=insights"
            aria-current={showInsights ? 'page' : undefined}
            className={tabClass(showInsights)}
          >
            Insights
          </Link>
        </nav>
        <div className="mt-8">
          {insights ? (
            <InsightsPanel
              insights={insights}
              tracks={tracks}
              digest={digest}
              canWriteDigest={canWriteDigest}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <FeedbackList
                  hasFeedback={hasFeedback}
                  initialData={formattedFeedback}
                />
              </div>
              <div className="space-y-8">
                {voucherStats && (vouchersOn || voucherStats.issued > 0) && (
                  <VouchersCard {...voucherStats} />
                )}
                <QRCodeSection uniqueCode={user.uniqueCode || ''} />
                <SpotsSection
                  code={user.uniqueCode || ''}
                  initialSpots={spots}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
