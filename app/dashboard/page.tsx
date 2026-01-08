import { redirect } from 'next/navigation'
import { and, avg, count, desc, eq, gte } from 'drizzle-orm'

import { getCurrentUser } from '../actions/auth'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardStats } from '@/components/dashboard-stats'
import { FeedbackList } from '@/components/feedback-list'
import { QRCodeSection } from '@/components/qr-code-section'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { getAudioUrl } from '@/lib/storage/r2'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all feedback data directly from DB
  const feedbackRecords = await db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, user.id))
    .orderBy(desc(feedback.createdAt))

  const hasFeedback = feedbackRecords.length > 0

  // Format feedback for client (same format as API)
  const formattedFeedback = await Promise.all(
    feedbackRecords.map(async (f) => {
      // Regenerate audio URL if we have audioKey
      let audioUrl = f.audioUrl || null
      if (f.audioKey && !audioUrl) {
        try {
          audioUrl = await getAudioUrl(f.audioKey)
        } catch (error) {
          console.error(
            `[Dashboard] Failed to generate audio URL for key ${f.audioKey}:`,
            error,
          )
        }
      }

      return {
        id: f.id,
        customerName: f.customerName || null,
        date: f.createdAt.toISOString(),
        duration: f.duration || 0,
        transcript: f.transcript || '',
        audioUrl,
        audioKey: f.audioKey || null,
        sentiment: f.sentiment as 'positive' | 'neutral' | 'negative' | null,
        createdAt: f.createdAt.toISOString(),
      }
    }),
  )

  // Calculate stats directly from DB
  const stats = {
    totalFeedback: 0,
    avgDuration: 0,
    thisWeekCount: 0,
  }

  if (hasFeedback) {
    // Get total feedback count
    const totalResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(eq(feedback.userId, user.id))

    stats.totalFeedback = totalResult[0]?.count || 0

    // Get average duration (in seconds)
    const avgResult = await db
      .select({ avgDuration: avg(feedback.duration) })
      .from(feedback)
      .where(eq(feedback.userId, user.id))

    stats.avgDuration = avgResult[0]?.avgDuration
      ? Number.parseFloat(avgResult[0].avgDuration)
      : 0

    // Get feedback count from this week (last 7 days)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const thisWeekResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(eq(feedback.userId, user.id), gte(feedback.createdAt, oneWeekAgo)),
      )

    stats.thisWeekCount = thisWeekResult[0]?.count || 0
  }

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
          totalFeedback={stats.totalFeedback}
          avgDuration={stats.avgDuration}
          thisWeekCount={stats.thisWeekCount}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            <FeedbackList
              hasFeedback={hasFeedback}
              userId={user.id}
              initialData={formattedFeedback}
            />
          </div>
          <div>
            <QRCodeSection uniqueCode={user.uniqueCode || ''} />
          </div>
        </div>
      </main>
    </div>
  )
}
