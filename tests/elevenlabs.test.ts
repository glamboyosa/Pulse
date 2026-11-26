import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('ElevenLabs lazy client initialization', () => {
  it('imports without an API key and throws a clear config error only when transcription runs', async () => {
    vi.stubEnv('ELEVEN_LABS_API_KEY', '')
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    vi.resetModules()

    const mod = await import('@/lib/ai/elevenlabs')
    expect(typeof mod.transcribeAudioWithElevenLabs).toBe('function')

    await expect(
      mod.transcribeAudioWithElevenLabs(Buffer.from('audio'), 'audio/webm'),
    ).rejects.toThrow(/ELEVEN_LABS_API_KEY is not configured/)
  })
})
