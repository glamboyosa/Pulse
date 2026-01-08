'use client'

import { useEffect, useState } from 'react'

interface FeedbackTranscriptProps {
  feedbackId: string
  initialTranscript: string | null
  initialSentiment: string | null
}

export function FeedbackTranscript({
  feedbackId,
  initialTranscript,
  initialSentiment,
}: FeedbackTranscriptProps) {
  const [transcript, setTranscript] = useState<string | null>(initialTranscript)
  const [sentiment, setSentiment] = useState<string | null>(initialSentiment)
  const [isPolling, setIsPolling] = useState(!initialTranscript)

  useEffect(() => {
    if (!initialTranscript) {
      // Poll for transcript updates every 2 seconds
      console.log(`[FeedbackTranscript] Starting polling for feedback: ${feedbackId}`)
      const pollInterval = setInterval(async () => {
        try {
          console.log(`[FeedbackTranscript] Polling for transcript update...`)
          const response = await fetch(`/api/feedback/${feedbackId}`)
          if (!response.ok) {
            console.error(`[FeedbackTranscript] Poll failed: ${response.statusText}`)
            return
          }
          const data = await response.json()
          console.log(`[FeedbackTranscript] Poll response:`, {
            hasTranscript: !!data.transcript,
            hasSentiment: !!data.sentiment,
          })

          if (data.transcript) {
            console.log(`[FeedbackTranscript] ✓ Transcript received!`)
            setTranscript(data.transcript)
            if (data.sentiment) {
              setSentiment(data.sentiment)
            }
            setIsPolling(false)
            clearInterval(pollInterval)
          }
        } catch (error) {
          console.error(`[FeedbackTranscript] Poll error:`, error)
        }
      }, 2000) // Poll every 2 seconds

      // Stop polling after 5 minutes (transcription should be done by then)
      const timeout = setTimeout(() => {
        console.log(`[FeedbackTranscript] Polling timeout reached`)
        clearInterval(pollInterval)
        setIsPolling(false)
      }, 5 * 60 * 1000)

      return () => {
        clearInterval(pollInterval)
        clearTimeout(timeout)
      }
    }
  }, [feedbackId, initialTranscript])

  return (
    <div className="bg-secondary border-4 border-foreground p-6">
      <h2 className="text-xl font-black mb-4">TRANSCRIPT</h2>
      {transcript ? (
        <p className="font-semibold leading-relaxed whitespace-pre-wrap">
          {transcript}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="font-semibold text-muted-foreground italic">
            Transcription in progress...
          </p>
          <p className="text-sm text-muted-foreground">
            {isPolling
              ? 'This page will automatically update when transcription is complete.'
              : 'Transcription is taking longer than expected. Please refresh the page to check.'}
          </p>
        </div>
      )}
    </div>
  )
}

