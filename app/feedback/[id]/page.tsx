import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { after } from 'next/server'

import { getCurrentUser } from '../../actions/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AudioPlayer } from '@/components/audio-player'
import { FeedbackTranscript } from '@/components/feedback-transcript'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import { retryAnalysis } from '@/server/feedback-submission'
import { ReplyBox } from '@/components/reply-box'
import { SENTIMENT_STYLE, isSentiment } from '@/lib/sentiment'
import { DeleteFeedbackButton } from '@/components/delete-feedback-button'

interface FeedbackPageProps {
  params: Promise<{ id: string }>
}

export default async function FeedbackPage({ params }: FeedbackPageProps) {
  const { id: feedbackId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get feedback record
  const feedbackRecord = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, feedbackId))
    .limit(1)

  if (feedbackRecord.length === 0) {
    notFound()
  }

  const feedbackData = feedbackRecord[0]

  // Verify the feedback belongs to the user
  if (feedbackData.userId !== user.id) {
    notFound()
  }

  const transcript = feedbackData.transcript
  const sentiment = feedbackData.sentiment
  const customerName = feedbackData.customerName

  // retryAnalysis decides whether this recording gets another try.
  if (
    feedbackData.status !== 'ready' ||
    (!transcript && feedbackData.audioKey)
  ) {
    after(() => retryAnalysis(feedbackId))
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="mb-6 font-bold border-2 border-foreground shadow-brutal-sm"
          >
            ← Back to Dashboard
          </Button>
        </Link>

        <Card className="p-8 border-2 border-foreground shadow-brutal-lg bg-card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-black">
                  {customerName || 'Anonymous'}
                </h1>
                {isSentiment(sentiment) && (
                  <span
                    className={`rounded-md border-2 border-foreground px-2 py-0.5 text-sm font-bold uppercase ${SENTIMENT_STYLE[sentiment].className}`}
                  >
                    {SENTIMENT_STYLE[sentiment].label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground">
                <span>{formatDate(feedbackData.createdAt)}</span>
                <span>•</span>
                <span>
                  {feedbackData.source === 'text'
                    ? 'Typed'
                    : formatDuration(feedbackData.duration)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {feedbackData.audioKey && (
              <AudioPlayer
                feedbackId={feedbackId}
                audioKey={feedbackData.audioKey}
                initialAudioUrl={feedbackData.audioUrl}
              />
            )}

            {feedbackData.summary && (
              <p className="text-2xl font-black leading-snug">
                {feedbackData.summary}
              </p>
            )}

            {feedbackData.translation && (
              <div className="bg-accent border-2 border-foreground p-6">
                <h2 className="text-xl font-black mb-4">In English</h2>
                <p className="font-semibold leading-relaxed whitespace-pre-wrap">
                  {feedbackData.translation}
                </p>
              </div>
            )}

            <FeedbackTranscript
              feedbackId={feedbackId}
              initialTranscript={transcript}
              language={feedbackData.translation ? feedbackData.language : null}
            />

            <ReplyBox
              feedbackId={feedbackId}
              customerName={customerName}
              reply={
                feedbackData.repliedAt && feedbackData.replyText
                  ? {
                      state: 'sent',
                      text: feedbackData.replyText,
                      sentOn: new Intl.DateTimeFormat('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        timeZone: 'UTC',
                      }).format(feedbackData.repliedAt),
                    }
                  : feedbackData.contactEmail
                    ? { state: 'wanted' }
                    : { state: 'none' }
              }
            />

            {feedbackData.themes.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {feedbackData.themes.map((theme) => (
                  <li
                    key={theme}
                    className="border-2 border-foreground px-3 py-1 text-sm font-bold uppercase"
                  >
                    {theme}
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t-2 border-foreground pt-6">
              <DeleteFeedbackButton feedbackId={feedbackId} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
