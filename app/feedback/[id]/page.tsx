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

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500'
      case 'negative':
        return 'bg-red-500'
      case 'neutral':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
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
      <div className="container mx-auto px-4 py-8">
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="mb-6 font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            ← Back to Dashboard
          </Button>
        </Link>

        <Card className="p-8 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-black">
                  {customerName || 'Anonymous'}
                </h1>
                {sentiment && (
                  <div
                    className={`w-4 h-4 ${getSentimentColor(sentiment)} border-2 border-foreground`}
                  />
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
              <div className="bg-accent border-4 border-foreground p-6">
                <h2 className="text-xl font-black mb-4">IN ENGLISH</h2>
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

            {sentiment && (
              <div className="bg-secondary border-4 border-foreground p-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Sentiment:</span>
                  <span className="font-black uppercase">{sentiment}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
