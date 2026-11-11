'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Mic, MicOff, RotateCcw, Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { MAX_CONTEXT_LENGTH } from '@/lib/widget-limits'

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const STILL_CHECKING =
  'One moment, we’re checking you’re not a bot. Try sending again in a few seconds.'

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
  | { name: 'idle' }
  | { name: 'asking' }
  | { name: 'denied' }
  | { name: 'recording' }
  | { name: 'recorded'; audio: Blob; url: string; seconds: number }
  | { name: 'sending'; audio: Blob; url: string; seconds: number }
  | { name: 'sent' }

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const cardClass = 'p-8 border-2 border-foreground shadow-brutal-lg bg-card'
const primaryButton =
  'flex-1 text-lg font-bold border-2 border-foreground shadow-brutal hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-[transform,box-shadow]'
const outlineButton =
  'font-bold border-2 border-foreground shadow-brutal-sm bg-transparent'

const LEVEL_BARS = 16

/** Live bars that move with the customer's voice, so they know it's working. */
function LevelMeter({ stream }: { stream: MediaStream | null }) {
  const [levels, setLevels] = useState<Array<number>>(() =>
    Array.from({ length: LEVEL_BARS }, () => 0),
  )

  useEffect(() => {
    if (!stream) return
    const audio = new AudioContext()
    // Safari starts a context made outside the tap suspended; resume it so
    // the bars actually move.
    void audio.resume()
    const analyser = audio.createAnalyser()
    analyser.fftSize = 64
    audio.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 50) return
      last = now
      analyser.getByteFrequencyData(data)
      setLevels(Array.from({ length: LEVEL_BARS }, (_, i) => data[i + 1] / 255))
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      void audio.close()
    }
  }, [stream])

  // Kept under reduced motion: it is the customer's only sign the microphone
  // is hearing them. It scales, so nothing around it reflows.
  return (
    <div
      aria-hidden="true"
      className="mt-6 mb-4 flex h-10 items-center justify-center gap-1"
    >
      {levels.map((level, i) => (
        <span
          key={i}
          className="h-full w-1.5 origin-center rounded-full bg-foreground"
          style={{ transform: `scaleY(${Math.max(0.12, level)})` }}
        />
      ))}
    </div>
  )
}

export function FeedbackForm({
  businessId,
  spot,
  accent,
  thankYouMessage,
  googleReviewUrl,
  widget,
}: {
  businessId: string
  /** The spot slug from the QR link, sent with the recording. */
  spot: string | null
  /** The owner's accent colour, used on the main button. */
  accent: string
  thankYouMessage: string | null
  googleReviewUrl: string | null
  /** Set inside the website widget: its key. */
  widget?: { key: string }
}) {
  const accentStyle = { backgroundColor: accent, color: '#ffffff' }
  const [stage, setStage] = useState<Stage>({ name: 'loading' })
  const [elapsed, setElapsed] = useState(0)
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Pulse is voice first. Typing appears only when voice can't work: the
  // browser can't record, or the customer blocked the microphone.
  const [canRecord, setCanRecord] = useState(true)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [sendingText, setSendingText] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  // Each token works once, so a fresh widget follows every send.
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileFailed, setTurnstileFailed] = useState(false)
  const freshTurnstile = () => {
    setTurnstileToken('')
    setTurnstileKey((key) => key + 1)
  }
  // Page context from the host website (JSON), sent with the feedback.
  const [widgetContext, setWidgetContext] = useState('')

  // The host page sends its context once the widget says it's ready. Only
  // the parent window counts: frame-ancestors already limits it to the
  // owner's listed sites.
  useEffect(() => {
    if (!widget) return
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as { type?: unknown; context?: unknown } | null
      if (data?.type !== 'pulse:context') return
      try {
        const json = JSON.stringify(data.context ?? {})
        // Over the server's limit it would be dropped anyway.
        setWidgetContext(json.length <= MAX_CONTEXT_LENGTH ? json : '')
      } catch {
        setWidgetContext('')
      }
    }
    // Escape inside the widget never reaches the host page, so pass it on.
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.parent.postMessage({ type: 'pulse:close' }, '*')
      }
    }
    window.addEventListener('message', receive)
    window.addEventListener('keydown', escape)
    window.parent.postMessage({ type: 'pulse:ready' }, '*')
    return () => {
      window.removeEventListener('message', receive)
      window.removeEventListener('keydown', escape)
    }
  }, [widget])

  useEffect(() => {
    if (widget && stage.name === 'sent') {
      window.parent.postMessage({ type: 'pulse:sent' }, '*')
    }
  }, [widget, stage.name])

  // Stop unmounts the record button; focus moves here instead of the page.
  const listenBackRef = useRef<HTMLParagraphElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => {
    if (
      typeof MediaRecorder === 'undefined' ||
      !('mediaDevices' in navigator)
    ) {
      setCanRecord(false)
      setTyping(true)
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

  // Only right after Stop: a failed send also returns to 'recorded', and
  // focus should then stay on the Send button.
  const previousStage = useRef(stage.name)
  useEffect(() => {
    if (stage.name === 'recorded' && previousStage.current === 'recording') {
      listenBackRef.current?.focus()
    }
    previousStage.current = stage.name
  }, [stage.name])

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
      setCanRecord(false)
      setTyping(true)
      setError(
        "This browser can't record audio, so type your feedback instead.",
      )
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
      setCanRecord(false)
      setTyping(true)
      setError("Recording couldn't start here, so type your feedback instead.")
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

  const submitText = async () => {
    if (text.trim().length < 3 || sendingText) return
    if (turnstileSiteKey && !turnstileToken) {
      setError(STILL_CHECKING)
      return
    }
    setError(null)
    setSendingText(true)
    const response = await fetch('/api/feedback/submit-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: businessId,
        text,
        ...(name.trim() && { customerName: name.trim() }),
        ...(spot && { spot }),
        ...(contactEmail.trim() && { contactEmail: contactEmail.trim() }),
        ...(turnstileToken && { turnstileToken }),
        ...(widget && { widgetKey: widget.key }),
        ...(widget && widgetContext && { context: widgetContext }),
      }),
    }).catch(() => null)
    freshTurnstile()
    if (response?.ok) {
      setStage({ name: 'sent' })
      return
    }
    if (response?.status === 402) {
      setStage({ name: 'not-accepting' })
      return
    }
    const { error: reason } = ((await response?.json().catch(() => ({}))) ??
      {}) as { error?: string }
    setError(
      response?.status === 429
        ? 'Lots of feedback from this connection just now. Please try again in a few minutes.'
        : response?.status === 400 && reason
          ? reason
          : "Your feedback didn't send. Please try again.",
    )
    // Leave the stage as it was, so a refused microphone keeps the toggle.
    setSendingText(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (typing) {
      await submitText()
      return
    }
    if (stage.name !== 'recorded') return
    if (turnstileSiteKey && !turnstileToken) {
      setError(STILL_CHECKING)
      return
    }
    setError(null)
    setStage({ ...stage, name: 'sending' })

    const extension = stage.audio.type.split('/')[1] || 'webm'
    const form = new FormData()
    form.append('code', businessId)
    form.append('audio', stage.audio, `feedback.${extension}`)
    form.append('duration', String(stage.seconds))
    if (name.trim()) form.append('customerName', name.trim())
    if (spot) form.append('spot', spot)
    if (contactEmail.trim()) form.append('contactEmail', contactEmail.trim())
    if (turnstileToken) form.append('turnstileToken', turnstileToken)
    if (widget) form.append('widgetKey', widget.key)
    if (widget && widgetContext) form.append('context', widgetContext)

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        body: form,
      }).finally(freshTurnstile)
      if (response.ok) {
        URL.revokeObjectURL(stage.url)
        setStage({ name: 'sent' })
        return
      }
      if (response.status === 402) {
        setStage({ name: 'not-accepting' })
        return
      }
      const { error: reason } = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      setError(
        response.status === 429
          ? 'Lots of feedback from this connection just now. Please try again in a few minutes.'
          : response.status === 400 && reason
            ? reason
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
        <div className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-foreground">
          <Check className="w-10 h-10" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black mb-4">Thank you!</h2>
        <p className="text-lg font-semibold leading-relaxed">
          Your feedback is on its way. Thanks for taking the time.
        </p>
        {thankYouMessage && (
          <p className="mt-6 border-2 border-dashed border-foreground p-4 text-xl font-black">
            {thankYouMessage}
          </p>
        )}
        {googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 border-2 border-foreground bg-card px-5 py-3 font-bold shadow-brutal-sm"
          >
            Leave a Google review too
          </a>
        )}
      </Card>
    )
  }

  if (stage.name === 'not-accepting') {
    return (
      <Card className={`${cardClass} text-center`}>
        <h2 className="text-2xl font-black mb-3">
          Not taking feedback right now
        </h2>
        <p className="font-semibold text-muted-foreground">
          This business isn&apos;t collecting voice feedback at the moment.
          Please let a member of staff know.
        </p>
      </Card>
    )
  }

  // Name and reply address come after recording, so the first screen is just
  // the record button.
  const nameField = (
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
        className="border-2 border-foreground font-semibold text-base"
      />
    </div>
  )

  // Offered once there is something to send, so the first screen stays simple.
  const contactField = (
    <div className="space-y-2">
      <Label htmlFor="contact" className="text-sm font-bold uppercase">
        Want a reply? Your email (optional)
      </Label>
      <Input
        id="contact"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        placeholder="you@example.com"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        aria-describedby="contact-hint"
        className="border-2 border-foreground font-semibold text-base"
      />
      <p
        id="contact-hint"
        className="text-sm font-semibold text-muted-foreground"
      >
        Only used for the team&apos;s reply. They won&apos;t see your address
        unless you write back.
      </p>
    </div>
  )

  const recorded = stage.name === 'recorded' || stage.name === 'sending'

  return (
    <form onSubmit={submit}>
      <Card className={cardClass}>
        <div className="space-y-6">
          {typing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="typed" className="text-sm font-bold uppercase">
                  Your feedback
                </Label>
                <textarea
                  id="typed"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={2000}
                  rows={6}
                  placeholder="What went well, and what could be better?"
                  aria-describedby="typed-hint"
                  className="w-full border-2 border-foreground bg-background p-3 text-base font-semibold"
                />
              </div>
              <p
                id="typed-hint"
                className="text-sm font-semibold text-muted-foreground"
              >
                At least 3 characters, up to 2,000.
              </p>
              {nameField}
              {contactField}
              <Button
                type="submit"
                disabled={
                  sendingText ||
                  stage.name === 'loading' ||
                  text.trim().length < 3
                }
                className={`w-full ${primaryButton}`}
                style={accentStyle}
              >
                <Send className="w-5 h-5 mr-2" />
                {sendingText ? 'SENDING…' : 'SEND FEEDBACK'}
              </Button>
            </div>
          ) : (
            <>
              <div
                className="flex flex-col items-center rounded-md bg-secondary px-6 py-8 text-center"
                aria-live="polite"
              >
                {recorded ? (
                  <>
                    <p
                      ref={listenBackRef}
                      tabIndex={-1}
                      className="mb-3 text-sm font-bold uppercase tracking-wider"
                    >
                      Listen back before you send
                    </p>
                    <audio
                      src={stage.url}
                      controls
                      className="w-full"
                      aria-label="Your recording"
                    />
                    <Button
                      type="button"
                      onClick={recordAgain}
                      variant="ghost"
                      disabled={stage.name === 'sending'}
                      className="mt-3 font-bold"
                    >
                      <RotateCcw className="size-4" />
                      Record again
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={
                        stage.name === 'recording'
                          ? stopRecording
                          : startRecording
                      }
                      disabled={
                        stage.name === 'loading' || stage.name === 'asking'
                      }
                      aria-label={
                        stage.name === 'recording'
                          ? 'Stop recording'
                          : stage.name === 'denied'
                            ? 'Try recording again'
                            : 'Start recording'
                      }
                      className="relative flex size-28 cursor-pointer items-center justify-center rounded-full border-2 border-foreground shadow-brutal transition-transform duration-150 ease-out active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
                      style={
                        stage.name === 'recording'
                          ? {
                              backgroundColor: 'var(--ink)',
                              color: 'var(--paper)',
                            }
                          : accentStyle
                      }
                    >
                      {stage.name === 'recording' ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 animate-ping rounded-full border-2 border-foreground opacity-30 motion-reduce:hidden"
                          />
                          <Square className="size-9" fill="currentColor" />
                        </>
                      ) : stage.name === 'denied' ? (
                        <MicOff className="size-11" strokeWidth={2.25} />
                      ) : (
                        <Mic className="size-11" strokeWidth={2.25} />
                      )}
                    </button>

                    {stage.name === 'recording' ? (
                      <>
                        <LevelMeter stream={streamRef.current} />
                        <p className="font-display text-4xl font-extrabold tabular-nums">
                          {formatTime(elapsed)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">
                          Recording… stops on its own at{' '}
                          {formatTime(MAX_SECONDS)}
                        </p>
                      </>
                    ) : stage.name === 'denied' ? (
                      <>
                        <p className="mt-5 text-lg font-bold">
                          Microphone is blocked
                        </p>
                        <p className="mt-1 max-w-[36ch] text-sm font-semibold text-muted-foreground">
                          Allow microphone access for this site in your browser
                          settings and try again, or type your feedback instead.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-5 text-lg font-bold">
                          {stage.name === 'asking'
                            ? 'Allow the microphone to start'
                            : 'Tap to record'}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">
                          Up to {MAX_SECONDS / 60} minutes. No app or account
                          needed.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>

              {recorded && nameField}
              {recorded && contactField}
              {recorded && (
                <Button
                  type="submit"
                  disabled={stage.name === 'sending'}
                  className={`w-full ${primaryButton}`}
                  style={accentStyle}
                >
                  <Send className="w-5 h-5 mr-2" />
                  {stage.name === 'sending' ? 'SENDING…' : 'SEND FEEDBACK'}
                </Button>
              )}
            </>
          )}

          {canRecord && (typing || stage.name === 'denied') && (
            <button
              type="button"
              onClick={() => {
                setTyping(!typing)
                setError(null)
              }}
              className="w-full text-center font-bold underline underline-offset-4"
            >
              {typing ? 'Record a voice note instead' : 'Prefer to type?'}
            </button>
          )}

          {turnstileSiteKey && (
            <TurnstileWidget
              key={turnstileKey}
              siteKey={turnstileSiteKey}
              onToken={(token) => {
                setTurnstileToken(token)
                if (!token) return
                setTurnstileFailed(false)
                setError((current) =>
                  current === STILL_CHECKING ? null : current,
                )
              }}
              onError={() => setTurnstileFailed(true)}
            />
          )}

          {turnstileFailed && (
            <div className="space-y-2">
              <p role="alert" className="font-bold text-destructive">
                We couldn&apos;t run the check that stops bots. If you use an ad
                or tracker blocker, allow this page, then try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTurnstileFailed(false)
                  freshTurnstile()
                }}
                className="font-bold underline underline-offset-4"
              >
                Try the check again
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="font-bold text-destructive">
              {error}
            </p>
          )}
        </div>
      </Card>
      <p className="text-center text-sm font-semibold text-muted-foreground mt-6">
        Your feedback goes only to this business, and is processed by AI.{' '}
        <a href="/privacy#customers" className="underline underline-offset-4">
          Privacy
        </a>
      </p>
    </form>
  )
}
