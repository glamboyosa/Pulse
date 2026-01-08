'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileText, Mic, Pause, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { api } from '@/lib/eden'

interface Feedback {
  id: string
  customerName?: string | null
  date: string
  duration: number // Duration in seconds
  transcript: string
  audioUrl?: string | null
  audioKey?: string | null // R2 key for regenerating URLs if audioUrl expires
  sentiment: 'positive' | 'neutral' | 'negative' | null
  createdAt: string
}

interface FeedbackListProps {
  hasFeedback?: boolean
  userId?: string
  initialData?: Array<Feedback> // Server-fetched feedback data
}

export function FeedbackList({
  hasFeedback = true,
  userId,
  initialData = [],
}: FeedbackListProps) {
  const router = useRouter()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<
    'all' | 'positive' | 'neutral' | 'negative'
  >('all')
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())

  // Fetch feedback using TanStack Query with initialData from server
  const {
    data: feedbackData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['feedback', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required')
      }
      const response = await api.feedback.get({
        query: {
          userId,
        },
      })
      if (response.error) {
        const error = response.error as
          | string
          | { message?: string; type?: string }
        const errorMessage =
          typeof error === 'string' ? error : error.message || 'Unknown error'
        throw new Error(errorMessage)
      }
      return response.data
    },
    enabled: hasFeedback && !!userId, // Only fetch if user has feedback and userId is provided
    initialData:
      initialData.length > 0
        ? ({ feedback: initialData } as { feedback: Array<Feedback> })
        : undefined, // Use server data as initialData to hydrate the query
  })

  // Format duration as "X secs" or "X mins Y secs"
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0 secs'
    if (seconds < 60) return `${seconds} sec${seconds === 1 ? '' : 's'}`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (secs === 0) return `${mins} min${mins === 1 ? '' : 's'}`
    return `${mins} min${mins === 1 ? '' : 's'} ${secs} sec${secs === 1 ? '' : 's'}`
  }

  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Format feedback with relative dates and formatted duration
  const feedbackList: Array<
    Feedback & { formattedDuration: string; displayName: string }
  > =
    feedbackData?.feedback.map((f: Feedback) => ({
      ...f,
      date: formatRelativeTime(f.createdAt),
      formattedDuration: formatDuration(f.duration),
      displayName: f.customerName || 'Anonymous',
    })) ?? []

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to load feedback'
    : null

  const filteredFeedback =
    filter === 'all'
      ? feedbackList
      : feedbackList.filter((f: Feedback) => f.sentiment === filter)

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      audioRefs.current.forEach((audio) => {
        audio.pause()
        audio.src = ''
      })
      audioRefs.current.clear()
    }
  }, [])

  const togglePlay = async (
    e: React.MouseEvent,
    item: Feedback & {
      formattedDuration: string
      displayName: string
      audioUrl?: string | null
      audioKey?: string | null
    },
  ) => {
    e.stopPropagation()

    console.log(`[FeedbackList] ===== togglePlay called =====`, {
      feedbackId: item.id,
      playingId,
      hasAudioKey: !!item.audioKey,
      hasAudioUrl: !!item.audioUrl,
    })

    if (playingId === item.id) {
      // Pause current audio
      console.log(`[FeedbackList] Pausing audio for feedback: ${item.id}`)
      const audio = audioRefs.current.get(item.id)
      if (audio) {
        audio.pause()
        setPlayingId(null)
      }
      return
    }

    // Stop any currently playing audio
    if (playingId) {
      console.log(
        `[FeedbackList] Stopping currently playing audio: ${playingId}`,
      )
      const currentAudio = audioRefs.current.get(playingId)
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
    }

    // Always regenerate audio URL to ensure it's fresh (presigned URLs expire)
    let audioUrl = item.audioUrl
    if (item.audioKey) {
      try {
        console.log(`[FeedbackList] Fetching fresh audio URL from API...`, {
          feedbackId: item.id,
          audioKey: item.audioKey,
        })
        const urlFetchStartTime = Date.now()
        // Always fetch a fresh URL from the API (presigned URLs expire after 1 hour)
        const response = await fetch(`/api/feedback/${item.id}/audio-url`)
        const urlFetchDuration = Date.now() - urlFetchStartTime
        console.log(
          `[FeedbackList] URL fetch response received in ${urlFetchDuration}ms`,
          {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          },
        )

        if (!response.ok) {
          throw new Error(`Failed to get audio URL: ${response.statusText}`)
        }
        const data = await response.json()
        console.log(`[FeedbackList] URL fetch data:`, {
          hasAudioUrl: !!data.audioUrl,
          hasError: !!data.error,
          audioUrlPreview: data.audioUrl?.substring(0, 100),
        })
        if (data.audioUrl) {
          audioUrl = data.audioUrl
          console.log(`[FeedbackList] ✓ Got fresh audio URL`)
        } else if (data.error) {
          throw new Error(data.error)
        } else {
          throw new Error('No audio URL in response')
        }
      } catch (audioError) {
        console.error(`[FeedbackList] ✗ Failed to get audio URL:`, {
          error:
            audioError instanceof Error
              ? audioError.message
              : String(audioError),
          feedbackId: item.id,
          audioKey: item.audioKey,
        })
        alert('Failed to load audio. Please try again.')
        return
      }
    }

    if (!audioUrl) {
      console.warn(`[FeedbackList] ✗ No audio URL available for feedback:`, {
        feedbackId: item.id,
        hasAudioKey: !!item.audioKey,
        hasInitialAudioUrl: !!item.audioUrl,
      })
      alert('Audio not available for this feedback.')
      return
    }

    console.log(`[FeedbackList] Creating audio element...`, {
      audioUrl: audioUrl.substring(0, 100) + '...',
    })

    // Create or get audio element
    let audio = audioRefs.current.get(item.id)

    // Always create a new audio element with fresh URL to avoid caching issues
    if (audio) {
      console.log(`[FeedbackList] Cleaning up existing audio element`)
      // Clean up old audio element
      audio.pause()
      audio.src = ''
      audioRefs.current.delete(item.id)
    }

    // Create new audio element with fresh URL
    // Note: Audio constructor will try to determine format from URL/Content-Type
    // Audio is stored as MP3 in R2
    audio = new Audio(audioUrl)

    // Set preload to help browser determine format
    audio.preload = 'auto'

    audioRefs.current.set(item.id, audio)

    // Set up event handlers
    audio.onended = () => {
      console.log(
        `[FeedbackList] Audio playback ended for feedback: ${item.id}`,
      )
      setPlayingId(null)
    }

    audio.onerror = (audioError: string | Event) => {
      const errorEvent = typeof audioError === 'string' ? null : audioError
      const audioElement = errorEvent?.target as HTMLAudioElement | undefined
      console.error(
        `[FeedbackList] ✗ Audio playback error for feedback: ${item.id}`,
        {
          error: audioError,
          errorType: errorEvent?.type,
          target: audioElement,
          audioSrc: audioElement?.src.substring(0, 100),
          audioNetworkState: audioElement?.networkState,
          audioReadyState: audioElement?.readyState,
          audioErrorCode: audioElement?.error?.code,
          audioErrorMessage: audioElement?.error?.message,
        },
      )
      setPlayingId(null)
      // Try to get a fresh URL and retry once
      if (item.audioKey) {
        console.log(
          `[FeedbackList] Attempting to refresh audio URL and retry...`,
        )
        fetch(`/api/feedback/${item.id}/audio-url`)
          .then((res) => res.json())
          .then((data) => {
            if (data.audioUrl) {
              console.log(`[FeedbackList] Got fresh URL, reloading audio...`)
              audio.src = data.audioUrl
              audio.load() // Reload with new URL
            } else {
              console.error(`[FeedbackList] No audio URL in refresh response`)
            }
          })
          .catch((err) => {
            console.error(`[FeedbackList] ✗ Failed to refresh audio URL:`, err)
            alert('Failed to play audio. The audio file may be unavailable.')
          })
      } else {
        alert('Failed to play audio. The audio file may be unavailable.')
      }
    }

    // Set up load handler to check if audio format is supported
    audio.oncanplay = () => {
      console.log(`[FeedbackList] ✓ Audio can play for feedback: ${item.id}`, {
        readyState: audio.readyState,
        networkState: audio.networkState,
        duration: audio.duration,
      })
    }

    audio.onloadstart = () => {
      console.log(
        `[FeedbackList] Audio loading started for feedback: ${item.id}`,
      )
    }

    audio.onloadeddata = () => {
      console.log(
        `[FeedbackList] ✓ Audio data loaded for feedback: ${item.id}`,
        {
          duration: audio.duration,
          readyState: audio.readyState,
        },
      )
    }

    audio.onloadedmetadata = () => {
      console.log(
        `[FeedbackList] ✓ Audio metadata loaded for feedback: ${item.id}`,
        {
          duration: audio.duration,
          readyState: audio.readyState,
        },
      )
    }

    try {
      console.log(`[FeedbackList] Attempting to play audio...`)
      await audio.play()
      console.log(
        `[FeedbackList] ✓ Audio playback started for feedback: ${item.id}`,
      )
      setPlayingId(item.id)
    } catch (playError) {
      console.error(`[FeedbackList] ✗ Failed to play audio:`, {
        error: playError,
        errorName: playError instanceof Error ? playError.name : 'Unknown',
        errorMessage:
          playError instanceof Error ? playError.message : String(playError),
        audioSrc: audio.src.substring(0, 100),
        audioReadyState: audio.readyState,
        audioNetworkState: audio.networkState,
      })
      setPlayingId(null)
      if (playError instanceof Error) {
        if (playError.name === 'NotSupportedError') {
          alert('Audio format not supported. Please try refreshing the page.')
        } else {
          alert(`Failed to play audio: ${playError.message}`)
        }
      }
    }
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

  const handleViewFeedback = (feedbackId: string) => {
    router.push(`/feedback/${feedbackId}`)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  // If we have initialData, we don't need to show loading state
  // The query will use initialData immediately and won't be in loading state

  // Show empty state only if we know there's no feedback
  if (!hasFeedback || feedbackList.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-black">RECENT FEEDBACK</h2>
        </div>
        <EmptyState
          icon={Mic}
          title="No Feedback Yet"
          description="Share your QR code with customers to start collecting voice feedback. Each submission uses one pulse."
        />
      </div>
    )
  }

  // Show empty state if filtered results are empty (but we have feedback)
  if (filteredFeedback.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-black">RECENT FEEDBACK</h2>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              ALL
            </Button>
            <Button
              variant={filter === 'positive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('positive')}
              className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              POSITIVE
            </Button>
            <Button
              variant={filter === 'neutral' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('neutral')}
              className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              NEUTRAL
            </Button>
          </div>
        </div>
        <EmptyState
          icon={Mic}
          title="No Feedback Found"
          description={`No ${filter === 'all' ? '' : filter} feedback matches your filter.`}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-black">RECENT FEEDBACK</h2>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            ALL
          </Button>
          <Button
            variant={filter === 'positive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('positive')}
            className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            POSITIVE
          </Button>
          <Button
            variant={filter === 'neutral' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('neutral')}
            className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            NEUTRAL
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredFeedback.map((item) => (
          <Card
            key={item.id}
            className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card cursor-pointer hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:border-primary transition-all group"
            onClick={() => handleViewFeedback(item.id)}
          >
            <div className="flex items-start gap-4">
              <Button
                size="icon"
                variant="outline"
                onClick={(e) => togglePlay(e, item)}
                className="shrink-0 w-12 h-12 border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {playingId === item.id ? (
                  <Pause className="w-5 h-5" fill="currentColor" />
                ) : (
                  <Play className="w-5 h-5" fill="currentColor" />
                )}
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-lg group-hover:text-primary transition-colors">
                        {item.displayName}
                      </h3>
                      <div
                        className={`w-3 h-3 ${getSentimentColor(item.sentiment)} border-2 border-foreground`}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                      <span>{item.date}</span>
                      <span>•</span>
                      <span>{item.formattedDuration}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewFeedback(item.id)
                      }}
                      className="border-2 border-transparent hover:border-foreground"
                    >
                      <FileText className="w-5 h-5" />
                    </Button>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
                <div className="bg-secondary border-4 border-foreground p-4">
                  {item.transcript ? (
                    <p className="font-semibold leading-relaxed line-clamp-2">
                      {item.transcript}
                    </p>
                  ) : (
                    <p className="font-semibold leading-relaxed text-muted-foreground italic">
                      Transcription pending...
                    </p>
                  )}
                </div>
                <div className="mt-3 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Click to view full feedback →
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
