// @vitest-environment jsdom
import React from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioPlayer } from '@/components/audio-player'

const fetchMock = vi.fn()
const loadSpy = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  loadSpy.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: loadSpy,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AudioPlayer', () => {
  it('reuses initialAudioUrl on mount without fetching and renders audio src directly', () => {
    const { container } = render(
      React.createElement(AudioPlayer, {
        feedbackId: 'fb-1',
        audioKey: 'feedback/1.m4a',
        initialAudioUrl: 'https://r2.test/feedback/1.m4a?sig=initial',
      }),
    )

    const audio = container.querySelector('audio')
    expect(audio).not.toBeNull()
    expect(audio?.getAttribute('src')).toBe(
      'https://r2.test/feedback/1.m4a?sig=initial',
    )
    expect(container.querySelectorAll('source')).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes at most once automatically on playback error, reloads after commit, then surfaces manual retry', async () => {
    const observedSrcOnLoad: Array<string | null> = []
    loadSpy.mockImplementation(function (this: HTMLMediaElement) {
      observedSrcOnLoad.push(this.getAttribute('src'))
    })

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audioUrl: 'https://r2.test/feedback/1.m4a?sig=refreshed-1',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audioUrl: 'https://r2.test/feedback/1.m4a?sig=manual-2',
          }),
          { status: 200 },
        ),
      )

    const { container } = render(
      React.createElement(AudioPlayer, {
        feedbackId: 'fb-1',
        audioKey: 'feedback/1.m4a',
        initialAudioUrl: 'https://r2.test/feedback/1.m4a?sig=expired',
      }),
    )

    const audio = container.querySelector('audio')!
    fireEvent.error(audio)

    await waitFor(() => {
      expect(audio.getAttribute('src')).toBe(
        'https://r2.test/feedback/1.m4a?sig=refreshed-1',
      )
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/feedback/fb-1/audio-url')
    expect(observedSrcOnLoad).toEqual([
      'https://r2.test/feedback/1.m4a?sig=refreshed-1',
    ])

    // Second error must stop auto-refreshing and present manual retry.
    fireEvent.error(audio)
    await waitFor(() => {
      expect(
        screen.getByText('Audio playback failed. Please try again.'),
      ).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(audio.getAttribute('src')).toBe(
        'https://r2.test/feedback/1.m4a?sig=manual-2',
      )
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resets automatic retry state when feedbackId changes', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ audioUrl: 'https://r2.test/feedback/1.m4a?sig=r1' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ audioUrl: 'https://r2.test/feedback/2.m4a?sig=r2' }),
          { status: 200 },
        ),
      )

    const { container, rerender } = render(
      React.createElement(AudioPlayer, {
        feedbackId: 'fb-1',
        audioKey: 'feedback/1.m4a',
        initialAudioUrl: 'https://r2.test/feedback/1.m4a?sig=old1',
      }),
    )

    // Exhaust auto-retry on fb-1.
    fireEvent.error(container.querySelector('audio')!)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/feedback/fb-1/audio-url')
    })
    fireEvent.error(container.querySelector('audio')!)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    })

    // Switch to fb-2: error clears and fb-2 gets its own 1 automatic refresh.
    rerender(
      React.createElement(AudioPlayer, {
        feedbackId: 'fb-2',
        audioKey: 'feedback/2.m4a',
        initialAudioUrl: 'https://r2.test/feedback/2.m4a?sig=old2',
      }),
    )

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    fireEvent.error(container.querySelector('audio')!)

    await waitFor(() => {
      expect(container.querySelector('audio')?.getAttribute('src')).toBe(
        'https://r2.test/feedback/2.m4a?sig=r2',
      )
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/feedback/fb-2/audio-url')
  })

  it('fetches on mount when initialAudioUrl is omitted and clears loading if audioKey becomes null mid-fetch', async () => {
    let resolveFetch!: (response: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )

    const { rerender } = render(
      React.createElement(AudioPlayer, {
        feedbackId: 'fb-1',
        audioKey: 'feedback/1.m4a',
        initialAudioUrl: null,
      }),
    )

    expect(screen.getByText('Loading audio…')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api/feedback/fb-1/audio-url')

    rerender(
      React.createElement(AudioPlayer, {
        feedbackId: 'fb-2',
        audioKey: null,
        initialAudioUrl: null,
      }),
    )

    expect(screen.getByText('Audio not available')).toBeTruthy()
    resolveFetch(
      new Response(
        JSON.stringify({ audioUrl: 'https://r2.test/feedback/1.m4a?sig=late' }),
        { status: 200 },
      ),
    )
    await waitFor(() => {
      expect(screen.getByText('Audio not available')).toBeTruthy()
    })
  })
})
