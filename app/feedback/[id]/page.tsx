import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { after } from 'next/server'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AudioPlayer } from '@/components/audio-player'
import { FeedbackTranscript } from '@/components/feedback-transcript'
import { getCurrentUser } from '../../actions/auth'
import { db } from '@/db/index'
import { feedback } from '@/db/schema'
import {
  transcribeAudioChunk,
  analyzeSentiment,
  extractNameFromTranscript,
} from '@/lib/ai/gemini'
import { downloadAudioChunk } from '@/lib/storage/r2'

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

  // If no transcript, trigger transcription on-demand
  let transcript = feedbackData.transcript
  let sentiment = feedbackData.sentiment
  let customerName = feedbackData.customerName

  if (!transcript && feedbackData.audioKey) {
    // Trigger transcription asynchronously using after()
    after(async () => {
      try {
        console.log(
          `[FeedbackPage] Starting on-demand transcription for feedback ${feedbackId}`,
        )

        // Download audio from R2
        const audioBuffer = await downloadAudioChunk(feedbackData.audioKey!)
        console.log(
          `[FeedbackPage] Downloaded audio, size: ${audioBuffer.length} bytes`,
        )

        // Determine MIME type from extension (OGG is Gemini-supported, no conversion!)
        const audioKey = feedbackData.audioKey
        if (!audioKey) {
          throw new Error('Audio key is missing for this feedback')
        }
        
        let transcriptionMimeType: string
        if (audioKey.endsWith('.ogg')) {
          transcriptionMimeType = 'audio/ogg'
        } else if (audioKey.endsWith('.wav')) {
          transcriptionMimeType = 'audio/wav'
        } else if (audioKey.endsWith('.mp3')) {
          transcriptionMimeType = 'audio/mp3'
        } else if (audioKey.endsWith('.aac')) {
          transcriptionMimeType = 'audio/aac'
        } else {
          transcriptionMimeType = 'audio/ogg' // Default to OGG
        }

        console.log(
          `[FeedbackPage] Transcribing audio (${transcriptionMimeType}), no conversion needed`,
        )

        // Transcribe using Files API (writes to /tmp)
        const newTranscript = await transcribeAudioChunk(
          audioBuffer,
          transcriptionMimeType,
        )
        console.log(
          `[FeedbackPage] Transcription complete, length: ${newTranscript.length}`,
        )

        // Analyze sentiment
        const newSentiment = await analyzeSentiment(newTranscript)
        console.log(`[FeedbackPage] Sentiment analyzed: ${newSentiment}`)

        // Extract name if not provided
        let newCustomerName = customerName
        if (!newCustomerName && newTranscript) {
          try {
            newCustomerName = await extractNameFromTranscript(newTranscript)
            console.log(
              `[FeedbackPage] Name extracted: ${newCustomerName || 'None'}`,
            )
          } catch (nameError) {
            console.error(`[FeedbackPage] Name extraction failed:`, nameError)
          }
        }

        // Update feedback record
        await db
          .update(feedback)
          .set({
            transcript: newTranscript,
            sentiment: newSentiment,
            customerName: newCustomerName,
          })
          .where(eq(feedback.id, feedbackId))

        console.log(`[FeedbackPage] Feedback updated with transcription`)
      } catch (error) {
        console.error(
          `[FeedbackPage] Error during on-demand transcription:`,
          error,
        )
      }
    })

    // Show loading state for transcript
    transcript = null
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
                <span>{formatDuration(feedbackData.duration)}</span>
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

            <FeedbackTranscript
              feedbackId={feedbackId}
              initialTranscript={transcript}
              initialSentiment={sentiment}
            />

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

