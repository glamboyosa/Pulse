'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

interface AudioPlayerProps {
  feedbackId: string
  audioKey?: string | null
  initialAudioUrl?: string | null
}

export function AudioPlayer({
  feedbackId,
  audioKey,
  initialAudioUrl,
}: AudioPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch fresh audio URL on mount and when needed
  const fetchAudioUrl = useCallback(async () => {
    if (!audioKey) {
      setError('No audio key available')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/feedback/${feedbackId}/audio-url`)
      if (!response.ok) {
        throw new Error(`Failed to get audio URL: ${response.statusText}`)
      }
      const data = await response.json()
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl)
      } else if (data.error) {
        throw new Error(data.error)
      } else {
        throw new Error('No audio URL in response')
      }
    } catch (fetchError) {
      console.error('Failed to fetch audio URL:', fetchError)
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load audio',
      )
      setAudioUrl(null)
    } finally {
      setIsLoading(false)
    }
  }, [feedbackId, audioKey])

  // Fetch fresh URL on mount (presigned URLs expire)
  useEffect(() => {
    if (audioKey) {
      fetchAudioUrl()
    }
  }, [audioKey, fetchAudioUrl])

  // Handle audio errors and retry
  const handleAudioError = () => {
    if (audioKey) {
      // Try to fetch a fresh URL and reload
      fetchAudioUrl().then(() => {
        if (audioRef.current && audioUrl) {
          audioRef.current.load()
        }
      })
    } else {
      setError('Audio playback failed. Please refresh the page.')
    }
  }

  if (error && !audioUrl) {
    return (
      <div className="bg-destructive/10 border-4 border-destructive p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <p className="font-semibold">{error}</p>
        </div>
        {audioKey && (
          <button
            onClick={fetchAudioUrl}
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
      <div className="bg-secondary border-4 border-foreground p-4">
        <p className="font-semibold text-muted-foreground">
          Loading audio...
        </p>
      </div>
    )
  }

  if (!audioUrl) {
    return (
      <div className="bg-secondary border-4 border-foreground p-4">
        <p className="font-semibold text-muted-foreground">
          Audio not available
        </p>
      </div>
    )
  }

  return (
    <div className="bg-secondary border-4 border-foreground p-4">
      <audio
        ref={audioRef}
        controls
        className="w-full"
        onError={handleAudioError}
      >
        <source src={audioUrl} type="audio/ogg" />
        <source src={audioUrl} type="audio/ogg;codecs=opus" />
        <source src={audioUrl} type="audio/wav" />
        <source src={audioUrl} type="audio/x-wav" />
        Your browser does not support the audio element.
      </audio>
      {error && (
        <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>
      )}
    </div>
  )
}

