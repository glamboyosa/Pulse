import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, avg, count, eq, gte } from 'drizzle-orm'

import { getCurrentUser } from '../actions/auth'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardStats } from '@/components/dashboard-stats'
import { FeedbackList } from '@/components/feedback-list'
import { QRCodeSection } from '@/components/qr-code-section'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { InsightsPanel } from '@/components/insights-panel'
import {
  MIN_FEEDBACK_FOR_DIGEST,
  countReadyFeedback,
  currentWeek,
  latestDigest,
} from '@/server/digest'
import { listFeedback } from '@/server/feedback-queries'
import { getInsights } from '@/server/insights'

const tabClass = (active: boolean) =>
  `px-5 py-2 border-4 border-foreground font-black transition-transform ${
    active
      ? 'bg-foreground text-background'
      : 'bg-card shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5'
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

  const showInsights = (await searchParams).tab === 'insights'
  const userFeedback = eq(feedback.userId, user.id)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [[totals], [thisWeek]] = await Promise.all([
    db
      .select({ count: count(), avgDuration: avg(feedback.duration) })
      .from(feedback)
      .where(userFeedback),
    db
      .select({ count: count() })
      .from(feedback)
      .where(and(userFeedback, gte(feedback.createdAt, weekAgo))),
  ])
  const hasFeedback = totals.count > 0

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

  return (
    <div className="min-h-screen bg-secondary">
      <DashboardHeader user={user} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            WELCOME BACK, {user.name.toUpperCase()}
          </h1>
          {user.businessName && (
            <p className="text-lg font-semibold text-muted-foreground">
              {user.businessName}
            </p>
          )}
        </div>
        <DashboardStats
          hasFeedback={hasFeedback}
          pulsesRemaining={user.pulsesRemaining || 0}
          totalFeedback={totals.count}
          avgDuration={totals.avgDuration ? Number(totals.avgDuration) : 0}
          thisWeekCount={thisWeek.count}
        />
        <nav aria-label="Dashboard" className="flex gap-3 mt-8">
          <Link
            href="/dashboard"
            aria-current={showInsights ? undefined : 'page'}
            className={tabClass(!showInsights)}
          >
            FEEDBACK
          </Link>
          <Link
            href="/dashboard?tab=insights"
            aria-current={showInsights ? 'page' : undefined}
            className={tabClass(showInsights)}
          >
            INSIGHTS
          </Link>
        </nav>
        <div className="mt-8">
          {insights ? (
            <InsightsPanel
              insights={insights}
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
              <div>
                <QRCodeSection uniqueCode={user.uniqueCode || ''} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
