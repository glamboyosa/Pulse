'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

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
    <div className="bg-secondary border-2 border-foreground p-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        aria-label="Recording"
        className="w-full"
        onError={handleAudioError}
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
