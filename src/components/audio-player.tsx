'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Pause, Play } from 'lucide-react'

import { JellyWave, useWaveMotion } from '@/components/jelly-wave'

interface AudioPlayerProps {
  feedbackId: string
  audioKey?: string | null
  initialAudioUrl?: string | null
}

const requestAudioUrl = async (feedbackId: string): Promise<string> => {
  const response = await fetch(`/api/feedback/${feedbackId}/audio-url`)
  if (!response.ok) {
    throw new Error(`Failed to get audio URL: ${response.statusText}`)
  }
  const data = (await response.json()) as { audioUrl?: string; error?: string }
  if (data.audioUrl) return data.audioUrl
  if (data.error) throw new Error(data.error)
  throw new Error('No audio URL in response')
}

const BARS = 28

/**
 * Bar heights for a recording's waveform. We don't have the real one, so the
 * shape comes from the recording's id: the same note always looks the same.
 */
const waveFor = (id: string) => {
  let seed = 0
  for (const char of id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0
  return Array.from({ length: BARS }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const envelope = 0.55 + 0.45 * Math.sin((Math.PI * (i + 1)) / (BARS + 1))
    return Math.round(6 + (seed / 2 ** 32) * 28 * envelope)
  })
}

export function AudioPlayer({
  feedbackId,
  audioKey,
  initialAudioUrl,
}: AudioPlayerProps) {
  const sourceKey = `${feedbackId}\0${audioKey ?? ''}\0${initialAudioUrl ?? ''}`
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey)
  const [audioUrl, setAudioUrl] = useState<string | null>(
    initialAudioUrl || null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(
    !initialAudioUrl && Boolean(audioKey),
  )
  const [reloadVersion, setReloadVersion] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasAutoRetriedRef = useRef(false)
  const requestIdRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [seeks, setSeeks] = useState(0)
  const [motion, setMotion] = useWaveMotion()
  const [wave] = useState(() => waveFor(feedbackId))
  const getProgress = () => {
    const audio = audioRef.current
    // Recordings from MediaRecorder can report an unknown length until played through.
    return audio && Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.currentTime / audio.duration
      : 0
  }

  if (prevSourceKey !== sourceKey) {
    setPrevSourceKey(sourceKey)
    setError(null)
    setReloadVersion(0)
    setAudioUrl(initialAudioUrl || null)
    setIsLoading(!initialAudioUrl && Boolean(audioKey))
  }

  const fetchAudioUrl = async (reloadAfterCommit = false) => {
    if (!audioKey) {
      setError('No audio key available')
      return
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const nextUrl = await requestAudioUrl(feedbackId)
      if (requestId !== requestIdRef.current) return
      setAudioUrl(nextUrl)
      if (reloadAfterCommit) {
        setReloadVersion((version) => version + 1)
      }
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return
      console.error('Failed to fetch audio URL:', fetchError)
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load audio',
      )
      setAudioUrl(null)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    const requestId = ++requestIdRef.current
    hasAutoRetriedRef.current = false
    if (initialAudioUrl || !audioKey) return

    const load = async () => {
      try {
        const nextUrl = await requestAudioUrl(feedbackId)
        if (requestId !== requestIdRef.current) return
        setAudioUrl(nextUrl)
      } catch (fetchError) {
        if (requestId !== requestIdRef.current) return
        console.error('Failed to fetch audio URL:', fetchError)
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to load audio',
        )
        setAudioUrl(null)
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    }
    void load()
  }, [feedbackId, audioKey, initialAudioUrl])

  useEffect(() => {
    if (reloadVersion > 0 && audioUrl) {
      audioRef.current?.load()
    }
  }, [audioUrl, reloadVersion])

  const handleAudioError = () => {
    if (audioKey && !hasAutoRetriedRef.current) {
      hasAutoRetriedRef.current = true
      void fetchAudioUrl(true)
      return
    }
    setError(
      audioKey
        ? 'Audio playback failed. Please try again.'
        : 'Audio playback failed. Please refresh the page.',
    )
  }

  const handleManualRetry = () => {
    void fetchAudioUrl(true)
  }

  if (error && !audioUrl) {
    return (
      <div className="bg-destructive/10 border-2 border-destructive p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <p className="font-semibold">{error}</p>
        </div>
        {audioKey && (
          <button
            type="button"
            onClick={handleManualRetry}
            className="mt-2 text-sm font-bold underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (isLoading && !audioUrl) {
    return (
      <div className="bg-secondary border-2 border-foreground p-4">
        <p className="font-semibold text-muted-foreground">Loading audio…</p>
      </div>
    )
  }

  if (!audioUrl) {
    return (
      <div className="bg-secondary border-2 border-foreground p-4">
        <p className="font-semibold text-muted-foreground">
          Audio not available
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <JellyWave
            heights={wave}
            getProgress={getProgress}
            playing={playing}
            motion={motion}
            progressVersion={seeks}
          >
            <button
              type="button"
              onClick={() => {
                const audio = audioRef.current
                if (!audio) return
                if (audio.paused) {
                  // A failure shows through the audio element's error handler.
                  audio.play().catch(() => {})
                } else audio.pause()
              }}
              aria-label={
                playing ? 'Pause the recording' : 'Play the recording'
              }
              className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-foreground bg-accent transition-transform duration-150 ease-out before:absolute before:-inset-1.5 active:scale-[0.96]"
            >
              {playing ? (
                <Pause
                  className="size-3.5"
                  fill="currentColor"
                  aria-hidden="true"
                />
              ) : (
                <Play
                  className="ml-0.5 size-3.5"
                  fill="currentColor"
                  aria-hidden="true"
                />
              )}
            </button>
          </JellyWave>
        </div>
        <button
          type="button"
          aria-pressed={motion}
          onClick={() => setMotion(!motion)}
          className={`min-h-11 shrink-0 cursor-pointer rounded-md border-2 border-foreground px-2.5 text-xs font-bold uppercase md:min-h-9 ${motion ? 'bg-foreground text-background' : 'bg-card'}`}
        >
          Wobble
        </button>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        aria-label="Recording"
        className="w-full"
        onError={handleAudioError}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onSeeked={() => setSeeks((count) => count + 1)}
        onEmptied={() => setSeeks((count) => count + 1)}
      >
        Your browser does not support the audio element.
      </audio>
      {error && (
        <div className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-destructive">
          <p>{error}</p>
          {audioKey && (
            <button
              type="button"
              onClick={handleManualRetry}
              className="font-bold underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
