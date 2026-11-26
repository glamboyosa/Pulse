import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

import { env } from '@/env'

let cachedClient: { apiKey: string; client: ElevenLabsClient } | null = null

const getElevenLabsClient = (): ElevenLabsClient => {
  const apiKey = env.ELEVEN_LABS_API_KEY ?? process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error(
      'ELEVEN_LABS_API_KEY is not configured. Set ELEVEN_LABS_API_KEY or ELEVENLABS_API_KEY.',
    )
  }
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new ElevenLabsClient({ apiKey }) }
  }
  return cachedClient.client
}

/**
 * Transcribes a recording in whatever language the customer spoke. ElevenLabs
 * detects the language itself; analysis translates it afterwards.
 */
export const transcribeAudioWithElevenLabs = async (
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> => {
  const elevenlabs = getElevenLabsClient()
  const transcription = await elevenlabs.speechToText.convert({
    file: new File([new Uint8Array(audioBuffer)], 'audio', { type: mimeType }),
    modelId: 'scribe_v1',
    tagAudioEvents: false,
  })

  if (!('text' in transcription)) {
    throw new Error('ElevenLabs returned no transcript text')
  }
  return transcription.text.trim()
}
