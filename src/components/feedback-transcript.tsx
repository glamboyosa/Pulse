'use client'

import { useEffect, useState } from 'react'

interface FeedbackTranscriptProps {
  feedbackId: string
  initialTranscript: string | null
}

type State = 'waiting' | 'ready' | 'failed' | 'timed-out'

const POLL_MS = 2000
const GIVE_UP_MS = 5 * 60 * 1000

export function FeedbackTranscript({
  feedbackId,
  initialTranscript,
}: FeedbackTranscriptProps) {
  const [transcript, setTranscript] = useState(initialTranscript)
  const [state, setState] = useState<State>(
    initialTranscript ? 'ready' : 'waiting',
  )

  useEffect(() => {
    if (state !== 'waiting') return

    const poll = setInterval(async () => {
      const response = await fetch(`/api/feedback/${feedbackId}`).catch(
        () => null,
      )
      if (!response?.ok) return
      const data: { transcript: string | null; status: string } =
        await response.json()
      if (data.transcript) {
        setTranscript(data.transcript)
        setState('ready')
      } else if (data.status === 'failed') {
        setState('failed')
      }
    }, POLL_MS)
    const giveUp = setTimeout(() => setState('timed-out'), GIVE_UP_MS)

    return () => {
      clearInterval(poll)
      clearTimeout(giveUp)
    }
  }, [feedbackId, state])

  return (
    <div className="bg-secondary border-4 border-foreground p-6">
      <h2 className="text-xl font-black mb-4">TRANSCRIPT</h2>
      {transcript ? (
        <p className="font-semibold leading-relaxed whitespace-pre-wrap">
          {transcript}
        </p>
      ) : (
        <p className="font-semibold text-muted-foreground">
          {state === 'failed'
            ? "We couldn't transcribe this recording. You can still listen to it above."
            : state === 'timed-out'
              ? 'Transcription is taking longer than usual. Refresh the page to check again.'
              : 'Transcribing… this page updates on its own.'}
        </p>
      )}
    </div>
  )
}
