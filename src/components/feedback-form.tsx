'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Mic, Pause, Play, RotateCcw, Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/eden'

interface FeedbackFormProps {
  businessId: string
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'playing' | 'submitted'

export function FeedbackForm({ businessId }: FeedbackFormProps) {
  const [name, setName] = useState('')
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [sentiment, setSentiment] = useState<string | null>(null)
  const [extractedName, setExtractedName] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Array<Blob>>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const feedbackIdRef = useRef<string | null>(null)
  const chunkIndexRef = useRef<number>(0)
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const selectedMimeTypeRef = useRef<string | null>(null)
  const finalAudioBase64Ref = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
      if (audioRef.current) audioRef.current.pause()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const streamChunk = async (
    chunkBlob: Blob,
    isLast: boolean = false,
    customerName?: string,
    providedTranscript?: string,
    providedSentiment?: string,
    finalAudioData?: string,
    finalAudioMimeType?: string,
  ) => {
    if (!feedbackIdRef.current) {
      console.error('[FeedbackForm] No feedbackId, cannot stream chunk')
      return
    }

    // Capture and increment chunk index immediately to prevent race conditions
    const chunkNum = chunkIndexRef.current
    chunkIndexRef.current += 1

    console.log(
      `[FeedbackForm] Streaming chunk ${chunkNum}${isLast ? ' (LAST)' : ''}`,
      {
        feedbackId: feedbackIdRef.current,
        chunkSize: chunkBlob.size,
        mimeType: chunkBlob.type,
        isLast,
      },
    )

    try {
      // Convert blob to base64
      console.log(`[FeedbackForm] Converting chunk ${chunkNum} to base64...`)
      const reader = new FileReader()
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string
          const base64Data = base64String.split(',')[1] || base64String
          console.log(
            `[FeedbackForm] Chunk ${chunkNum} converted to base64, size: ${base64Data.length} chars`,
          )
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(chunkBlob)
      })

      console.log(
        `[FeedbackForm] Sending chunk ${chunkNum} to API...`,
        isLast ? { customerName, duration: recordingTime } : {},
      )
      const apiClient = api
      const response = await apiClient.feedback['stream-chunk'].post({
        businessId,
        feedbackId: feedbackIdRef.current,
        chunkIndex: chunkNum,
        audioData: base64Audio,
        mimeType: chunkBlob.type || selectedMimeTypeRef.current || 'audio/mpeg', // Use selected format or MP3 fallback
        isLastChunk: isLast,
        customerName: isLast ? customerName || undefined : undefined,
        duration: isLast ? recordingTime : undefined,
        transcript: isLast ? providedTranscript || undefined : undefined,
        sentiment: isLast ? providedSentiment || undefined : undefined,
        finalAudioData: isLast ? finalAudioData || undefined : undefined,
        finalAudioMimeType: isLast
          ? finalAudioMimeType || selectedMimeTypeRef.current || undefined
          : undefined,
      })

      console.log(
        `[FeedbackForm] Chunk ${chunkNum} sent successfully`,
        isLast ? '(FINAL CHUNK - processing transcript and sentiment)' : '',
      )
    } catch (error) {
      console.error(`[FeedbackForm] Error streaming chunk ${chunkNum}:`, error)
      // Don't alert on every chunk error, just log it
      if (isLast) {
        // Only alert on last chunk error as it's critical
        console.error(
          '[FeedbackForm] CRITICAL: Failed to submit final chunk',
          error,
        )
        throw error
      }
    }
  }

  const startRecording = async () => {
    try {
      console.log('[FeedbackForm] startRecording called')

      // Check if MediaRecorder is supported
      // Runtime check needed even though TypeScript thinks navigator is always defined
      if (typeof navigator === 'undefined') {
        throw new Error('MediaRecorder API is not supported in this browser')
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaRecorder API is not supported in this browser')
      }

      // Check if business has pulses before starting recording
      // TODO: Uncomment once Polar payment is fixed
      // const apiClient = api
      // // @ts-expect-error - Eden Treaty types don't fully support nested routes
      // const pulseCheck = await apiClient.feedback['check-pulses'].get({
      //   query: { businessId },
      // })

      // if (
      //   !pulseCheck.data?.hasPulses ||
      //   (pulseCheck.data?.pulsesRemaining ?? 0) <= 0
      // ) {
      //   alert(
      //     'This business has no pulses remaining. Please contact them to purchase more pulses.',
      //   )
      //   return
      // }

      console.log('[FeedbackForm] Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log(
        '[FeedbackForm] Microphone access granted, initializing recorder...',
      )
      streamRef.current = stream

      // Gemini supports: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC (NOT WebM!)
      // Prioritize formats that work with both browser AND Gemini
      // MP3 is universal, AAC works in Edge/Safari, OGG works in Chrome/Firefox
      const preferredMimeTypes = [
        'audio/mpeg', // MP3 - Universal support (all browsers + Gemini)
        'audio/mp4', // AAC - Edge/Safari support (Gemini supports AAC)
        'audio/ogg;codecs=opus', // OGG Vorbis - Chrome/Firefox (Gemini supports OGG)
        'audio/ogg', // OGG fallback
      ]
      let selectedMimeType: string | null = null

      for (const mimeType of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          console.log(`[FeedbackForm] ✓ Using supported mimeType: ${mimeType}`)
          break
        } else {
          console.log(`[FeedbackForm] ✗ mimeType not supported: ${mimeType}`)
        }
      }

      if (
        !selectedMimeType ||
        !MediaRecorder.isTypeSupported(selectedMimeType)
      ) {
        // Detect browser for better error message
        const userAgent = navigator.userAgent.toLowerCase()
        const isEdge = userAgent.includes('edg/')
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
        const browserName = isEdge
          ? 'Edge'
          : isSafari
            ? 'Safari'
            : 'your browser'

        throw new Error(
          `Audio recording is not supported in ${browserName}. Please use a modern browser that supports MP3, AAC, or OGG audio recording (Chrome, Firefox, Edge, or Safari).`,
        )
      }

      // Store selected MIME type in ref for use in streamChunk
      selectedMimeTypeRef.current = selectedMimeType

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      chunkIndexRef.current = 0
      feedbackIdRef.current = crypto.randomUUID()
      console.log('[FeedbackForm] Recording started', {
        feedbackId: feedbackIdRef.current,
        mimeType: selectedMimeType,
        maxDuration: '10:00',
      })

      // Stream chunks every 2 seconds (WhatsApp-like experience)
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log(
            `[FeedbackForm] MediaRecorder data available, chunk size: ${event.data.size} bytes`,
          )
          audioChunksRef.current.push(event.data)
          // Stream chunk immediately
          await streamChunk(event.data, false)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('[FeedbackForm] Recording stopped', {
          totalChunks: audioChunksRef.current.length,
          totalDuration: recordingTime,
        })

        const recordedBlob = new Blob(audioChunksRef.current, {
          type: selectedMimeTypeRef.current || 'audio/mpeg', // Use the same MIME type we recorded with
        })
        console.log('[FeedbackForm] Final audio blob created', {
          size: recordedBlob.size,
          type: recordedBlob.type,
        })
        setAudioBlob(recordedBlob)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        console.log('[FeedbackForm] Media stream tracks stopped')

        // Transcribe audio immediately after recording stops (before submission)
        console.log('[FeedbackForm] Starting transcription...')
        setIsTranscribing(true)
        try {
          // Convert blob to base64
          const reader = new FileReader()
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64String = reader.result as string
              const base64Data = base64String.split(',')[1] || base64String
              finalAudioBase64Ref.current = base64Data
              resolve(base64Data)
            }
            reader.onerror = reject
            reader.readAsDataURL(recordedBlob)
          })

          console.log('[FeedbackForm] Sending audio for transcription...')
          const apiClient = api
          const response = await apiClient.feedback.transcribe.post({
            audioData: base64Audio,
            mimeType: selectedMimeTypeRef.current || 'audio/mpeg',
          })

          if (response.data?.success && response.data.transcript) {
            console.log('[FeedbackForm] ✓ Transcription complete!', {
              transcriptLength: response.data.transcript.length,
              sentiment: response.data.sentiment,
              extractedName: response.data.customerName,
            })
            setTranscript(response.data.transcript)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            setSentiment(response.data.sentiment || null)
            if (response.data.customerName) {
              setExtractedName(response.data.customerName)
              // Auto-fill name if not already set
              if (!name) {
                setName(response.data.customerName)
              }
            }
          } else {
            console.error(
              '[FeedbackForm] Transcription failed:',
              response.data?.error,
            )
            // Don't throw - we'll still allow submission without transcript
          }
        } catch (error) {
          console.error('[FeedbackForm] Transcription error:', error)
          // Don't throw - we'll still allow submission without transcript
        } finally {
          setIsTranscribing(false)
        }
      }

      // Start recording with timeslice of 2000ms (2 seconds) for streaming
      console.log('[FeedbackForm] Starting MediaRecorder with 2s intervals...')
      mediaRecorder.start(2000)
      console.log(
        '[FeedbackForm] MediaRecorder started, setting state to recording',
      )
      setRecordingState('recording')
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 600) {
            // Max 10 minutes
            console.log(
              '[FeedbackForm] Max recording time reached (10 minutes)',
            )
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      console.error('[FeedbackForm] Error in startRecording:', err)
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unknown error occurred while starting recording'
      console.error('[FeedbackForm] Error details:', {
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
      })
      alert(
        `Unable to start recording: ${errorMessage}. Please check your microphone permissions and try again.`,
      )
      setRecordingState('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop()
      setRecordingState('stopped')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const playAudio = () => {
    if (audioBlob && recordingState === 'stopped') {
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audioRef.current = audio
      audio.onended = () => {
        setRecordingState('stopped')
        audioRef.current = null
      }
      audio.play()
      setRecordingState('playing')
    }
  }

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setRecordingState('stopped')
    }
  }

  const resetRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
    setRecordingState('idle')
    setRecordingTime(0)
    setAudioBlob(null)
    audioChunksRef.current = []
    feedbackIdRef.current = null
    chunkIndexRef.current = 0
    selectedMimeTypeRef.current = null
    finalAudioBase64Ref.current = null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audioBlob || !feedbackIdRef.current) {
      alert('Please record your feedback first')
      return
    }

    console.log('[FeedbackForm] Submitting feedback...', {
      feedbackId: feedbackIdRef.current,
      customerName: name || 'Anonymous',
      duration: recordingTime,
      audioBlobSize: audioBlob.size,
    })

    setIsSubmitting(true)

    try {
      let finalAudioBase64 = finalAudioBase64Ref.current
      if (!finalAudioBase64) {
        const reader = new FileReader()
        finalAudioBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64String = reader.result as string
            const base64Data = base64String.split(',')[1] || base64String
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(audioBlob)
        })
        finalAudioBase64Ref.current = finalAudioBase64
      }

      // Send the final chunk with isLastChunk=true and customer name
      // This will create the feedback record with sentiment analysis
      const lastChunk =
        audioChunksRef.current[audioChunksRef.current.length - 1] || audioBlob
      console.log('[FeedbackForm] Sending final chunk for processing...')
      await streamChunk(
        lastChunk,
        true,
        name || undefined,
        transcript || undefined,
        sentiment || undefined,
        finalAudioBase64 || undefined,
        selectedMimeTypeRef.current || audioBlob.type || undefined,
      )

      console.log('[FeedbackForm] Feedback submitted successfully!')
      setRecordingState('submitted')
    } catch (error) {
      console.error('[FeedbackForm] Error submitting feedback:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to submit feedback. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (recordingState === 'submitted') {
    return (
      <Card className="p-12 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card text-center">
        <div className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-foreground">
          <Check className="w-10 h-10" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black mb-4">THANK YOU!</h2>
        <p className="text-lg font-semibold leading-relaxed mb-6">
          Your feedback has been submitted successfully. We appreciate you
          taking the time to share your thoughts!
        </p>
        <Button
          onClick={resetRecording}
          variant="outline"
          className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent"
        >
          Submit Another
        </Button>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-8 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card">
        <div className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold uppercase">
              Your Name (Optional)
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Leave blank to stay anonymous"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-4 border-foreground font-semibold"
            />
          </div>

          {/* Recording Section */}
          <div className="space-y-4">
            <Label className="text-sm font-bold uppercase">
              Voice Feedback
            </Label>

            {/* Recording Display */}
            <div className="bg-secondary border-4 border-foreground p-8">
              <div className="text-center">
                {recordingState === 'idle' && (
                  <>
                    <Mic
                      className="w-16 h-16 mx-auto mb-4 text-primary"
                      strokeWidth={2}
                    />
                    <p className="text-lg font-bold mb-2">Ready to record</p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Click the button below to start
                    </p>
                  </>
                )}

                {recordingState === 'recording' && (
                  <>
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <Mic
                        className="w-16 h-16 text-destructive animate-pulse"
                        strokeWidth={2}
                      />
                      <div className="absolute inset-0 border-4 border-destructive rounded-full animate-ping" />
                    </div>
                    <p className="text-3xl font-black mb-2 text-destructive">
                      {formatTime(recordingTime)}
                    </p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Recording... (Max 10:00)
                    </p>
                  </>
                )}

                {(recordingState === 'stopped' ||
                  recordingState === 'playing') && (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 bg-primary border-4 border-foreground flex items-center justify-center">
                      {recordingState === 'playing' ? (
                        <Pause className="w-8 h-8 text-primary-foreground" />
                      ) : (
                        <Play className="w-8 h-8 text-primary-foreground" />
                      )}
                    </div>
                    <p className="text-3xl font-black mb-2">
                      {formatTime(recordingTime)}
                    </p>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Recording complete
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex gap-3">
              {recordingState === 'idle' && (
                <Button
                  type="button"
                  onClick={(e) => {
                    console.log('[FeedbackForm] Start recording button clicked')
                    e.preventDefault()
                    startRecording()
                  }}
                  className="flex-1 text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  START RECORDING
                </Button>
              )}

              {recordingState === 'recording' && (
                <Button
                  type="button"
                  onClick={stopRecording}
                  variant="destructive"
                  className="flex-1 text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                >
                  <Square className="w-5 h-5 mr-2" />
                  STOP RECORDING
                </Button>
              )}

              {(recordingState === 'stopped' ||
                recordingState === 'playing') && (
                <>
                  <Button
                    type="button"
                    onClick={
                      recordingState === 'playing' ? pauseAudio : playAudio
                    }
                    variant="outline"
                    className="flex-1 font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent"
                  >
                    {recordingState === 'playing' ? (
                      <>
                        <Pause className="w-5 h-5 mr-2" />
                        PAUSE
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        PLAY
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={resetRecording}
                    variant="outline"
                    className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-transparent"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          {(recordingState === 'stopped' || recordingState === 'playing') && (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              <Send className="w-5 h-5 mr-2" />
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
            </Button>
          )}
        </div>
      </Card>
      <p className="text-center text-sm font-semibold text-muted-foreground mt-6">
        Your feedback is confidential and helps us improve our service
      </p>
    </form>
  )
}
