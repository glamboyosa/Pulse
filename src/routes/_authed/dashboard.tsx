import { createFileRoute, redirect } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardStats } from '@/components/dashboard-stats'
import { FeedbackList } from '@/components/feedback-list'
import { QRCodeSection } from '@/components/qr-code-section'
import { getCurrentUserFn } from '@/lib/server-functions/auth'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'

export const Route = createFileRoute('/_authed/dashboard')({
  loader: async () => {
    const user = await getCurrentUserFn()

    if (!user) {
      throw redirect({
        to: '/login',
      })
    }

    // Check if user has feedback from DB
    const feedbackRecords = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, user.id))
      .limit(1)

    const hasFeedback = feedbackRecords.length > 0

    return { hasFeedback }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = Route.useRouteContext()
  const { hasFeedback } = Route.useLoaderData()

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
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            <FeedbackList hasFeedback={hasFeedback} />
          </div>
          <div>
            <QRCodeSection uniqueCode={user.uniqueCode || ''} />
          </div>
        </div>
      </main>
    </div>
  )
}
