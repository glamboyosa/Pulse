'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Mic, MicOff, RotateCcw, Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAX_SECONDS = 120

// Safari and newer Chrome record mp4; older Android Chrome only webm;
// Firefox ogg. The first one this browser supports wins.
const RECORDING_TYPES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

type Stage =
  | { name: 'loading' }
  | { name: 'not-accepting' }
  | { name: 'unsupported' }
  | { name: 'idle' }
  | { name: 'asking' }
  | { name: 'denied' }
  | { name: 'recording' }
  | { name: 'recorded'; audio: Blob; url: string; seconds: number }
  | { name: 'sending'; audio: Blob; url: string; seconds: number }
  | { name: 'sent' }

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const cardClass =
  'p-8 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card'
const primaryButton =
  'flex-1 text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all'
const outlineButton =
  'font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent'

export function FeedbackForm({
  businessId,
  spot,
}: {
  businessId: string
  /** The spot slug from the QR link, sent with the recording. */
  spot: string | null
}) {
  const [stage, setStage] = useState<Stage>({ name: 'loading' })
  const [elapsed, setElapsed] = useState(0)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => {
    if (
      typeof MediaRecorder === 'undefined' ||
      !('mediaDevices' in navigator)
    ) {
      setStage({ name: 'unsupported' })
      return
    }
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/status`)
      .then((response) => (response.ok ? response.json() : { accepting: true }))
      .then((data: { accepting: boolean }) =>
        setStage(data.accepting ? { name: 'idle' } : { name: 'not-accepting' }),
      )
      // If the check fails, let them record; the submit will say if it can't.
      .catch(() => setStage({ name: 'idle' }))
  }, [businessId])

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => releaseMicrophone, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  // Ticks the timer and stops at the limit. Reads the recorder through a ref,
  // so the stop always reaches the live recording.
  useEffect(() => {
    if (stage.name !== 'recording') return
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsed(seconds)
      if (seconds >= MAX_SECONDS) stopRecording()
    }, 250)
    return () => clearInterval(tick)
  }, [stage.name, stopRecording])

  const startRecording = async () => {
    setError(null)
    setStage({ name: 'asking' })
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStage({ name: 'denied' })
      return
    }
    streamRef.current = stream

    const mimeType = RECORDING_TYPES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    )
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
    } catch {
      releaseMicrophone()
      setError("This browser can't record audio. Try another browser.")
      setStage({ name: 'idle' })
      return
    }
    const chunks: Array<Blob> = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      releaseMicrophone()
      const seconds = Math.min(
        MAX_SECONDS,
        Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      )
      const audio = new Blob(chunks, {
        type: (recorder.mimeType || mimeType || 'audio/webm').split(';')[0],
      })
      setStage({
        name: 'recorded',
        audio,
        url: URL.createObjectURL(audio),
        seconds,
      })
    }

    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    setElapsed(0)
    try {
      recorder.start()
    } catch {
      releaseMicrophone()
      setError("Recording couldn't start. Check your microphone and try again.")
      setStage({ name: 'idle' })
      return
    }
    setStage({ name: 'recording' })
  }

  const recordAgain = () => {
    if (stage.name === 'recorded') URL.revokeObjectURL(stage.url)
    setError(null)
    setStage({ name: 'idle' })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (stage.name !== 'recorded') return
    setError(null)
    setStage({ ...stage, name: 'sending' })

    const extension = stage.audio.type.split('/')[1] || 'webm'
    const form = new FormData()
    form.append('code', businessId)
    form.append('audio', stage.audio, `feedback.${extension}`)
    form.append('duration', String(stage.seconds))
    if (name.trim()) form.append('customerName', name.trim())
    if (spot) form.append('spot', spot)

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        body: form,
      })
      if (response.ok) {
        URL.revokeObjectURL(stage.url)
        setStage({ name: 'sent' })
        return
      }
      if (response.status === 402) {
        setStage({ name: 'not-accepting' })
        return
      }
      setError(
        response.status === 429
          ? 'Lots of feedback from this connection just now. Please try again in a few minutes.'
          : "Your recording didn't send. Please try again.",
      )
    } catch {
      setError(
        "Your recording didn't send. Check your connection and try again.",
      )
    }
    setStage({ ...stage, name: 'recorded' })
  }

  if (stage.name === 'sent') {
    return (
      <Card className={`${cardClass} text-center`}>
        <div className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-foreground">
          <Check className="w-10 h-10" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black mb-4">THANK YOU!</h2>
        <p className="text-lg font-semibold leading-relaxed">
          Your feedback is on its way. Thanks for taking the time.
        </p>
      </Card>
    )
  }

  if (stage.name === 'not-accepting') {
    return (
      <Card className={`${cardClass} text-center`}>
        <h2 className="text-2xl font-black mb-3">
          NOT TAKING FEEDBACK RIGHT NOW
        </h2>
        <p className="font-semibold text-muted-foreground">
          This business isn&apos;t collecting voice feedback at the moment.
          Please let a member of staff know.
        </p>
      </Card>
    )
  }

  if (stage.name === 'unsupported') {
    return (
      <Card className={`${cardClass} text-center`}>
        <h2 className="text-2xl font-black mb-3">
          THIS BROWSER CAN&apos;T RECORD
        </h2>
        <p className="font-semibold text-muted-foreground">
          Open this page in Safari, Chrome or Firefox to leave voice feedback.
        </p>
      </Card>
    )
  }

  const recorded = stage.name === 'recorded' || stage.name === 'sending'

  return (
    <form onSubmit={submit}>
      <Card className={cardClass}>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold uppercase">
              Your name (optional)
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="given-name"
              maxLength={80}
              placeholder="Leave blank to stay anonymous"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-4 border-foreground font-semibold text-base"
            />
          </div>

          <div
            className="bg-secondary border-4 border-foreground p-8 text-center"
            aria-live="polite"
          >
            {stage.name === 'recording' ? (
              <>
                <Mic
                  className="w-16 h-16 mx-auto mb-4 text-destructive animate-pulse"
                  strokeWidth={2}
                />
                <p className="text-3xl font-black mb-2 text-destructive tabular-nums">
                  {formatTime(elapsed)}
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Recording… stops on its own at {formatTime(MAX_SECONDS)}
                </p>
              </>
            ) : recorded ? (
              <>
                <p className="text-sm font-bold uppercase mb-3">
                  Listen back before you send
                </p>
                <audio
                  src={stage.url}
                  controls
                  className="w-full"
                  aria-label="Your recording"
                />
              </>
            ) : stage.name === 'denied' ? (
              <>
                <MicOff className="w-16 h-16 mx-auto mb-4" strokeWidth={2} />
                <p className="text-lg font-bold mb-2">Microphone is blocked</p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Allow microphone access for this site in your browser
                  settings, then try again.
                </p>
              </>
            ) : (
              <>
                <Mic
                  className="w-16 h-16 mx-auto mb-4 text-primary"
                  strokeWidth={2}
                />
                <p className="text-lg font-bold mb-2">
                  {stage.name === 'asking'
                    ? 'Allow the microphone to start'
                    : 'Tell us how it went'}
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  Up to {MAX_SECONDS / 60} minutes. No app or account needed.
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            {stage.name === 'recording' ? (
              <Button
                type="button"
                onClick={stopRecording}
                variant="destructive"
                className={primaryButton}
              >
                <Square className="w-5 h-5 mr-2" />
                STOP
              </Button>
            ) : recorded ? (
              <Button
                type="button"
                onClick={recordAgain}
                variant="outline"
                disabled={stage.name === 'sending'}
                className={`flex-1 ${outlineButton}`}
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                RECORD AGAIN
              </Button>
            ) : (
              <Button
                type="button"
                onClick={startRecording}
                disabled={stage.name === 'loading' || stage.name === 'asking'}
                className={primaryButton}
              >
                <Mic className="w-5 h-5 mr-2" />
                {stage.name === 'denied' ? 'TRY AGAIN' : 'START RECORDING'}
              </Button>
            )}
          </div>

          {recorded && (
            <Button
              type="submit"
              disabled={stage.name === 'sending'}
              className={`w-full ${primaryButton}`}
            >
              <Send className="w-5 h-5 mr-2" />
              {stage.name === 'sending' ? 'SENDING…' : 'SEND FEEDBACK'}
            </Button>
          )}

          {error && (
            <p role="alert" className="font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      </Card>
      <p className="text-center text-sm font-semibold text-muted-foreground mt-6">
        Your recording goes only to this business.
      </p>
    </form>
  )
}
