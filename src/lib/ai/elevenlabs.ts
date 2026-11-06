import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

import { env } from '@/env'

const elevenlabs = new ElevenLabsClient({ apiKey: env.ELEVEN_LABS_API_KEY })

/**
 * Transcribes a recording in whatever language the customer spoke. ElevenLabs
 * detects the language itself; analysis translates it afterwards.
 */
export const transcribeAudioWithElevenLabs = async (
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> => {
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
