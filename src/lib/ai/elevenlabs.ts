import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { env } from '@/env'

// Initialize ElevenLabs client
export const elevenlabs = new ElevenLabsClient({
  apiKey: env.ELEVEN_LABS_API_KEY,
})

/**
 * Transcribe audio buffer using ElevenLabs Speech-to-Text API
 * @param audioBuffer - Audio data as Buffer
 * @param mimeType - MIME type of the audio (optional, defaults to 'audio/mp3')
 * @returns The transcribed text
 */
export async function transcribeAudioWithElevenLabs(
  audioBuffer: Buffer,
  mimeType: string = 'audio/mp3',
): Promise<string> {
  const transcriptionStartTime = Date.now()
  console.log(`[ElevenLabs] Starting transcription...`, {
    mimeType,
    bufferSize: audioBuffer.length,
  })

  try {
    // In Node.js, we need to create a File-like object from the Buffer
    // The ElevenLabs SDK expects a File or Blob, but in Node.js we can pass the buffer directly
    // as a File object with the buffer as the content
    const { File } = await import('node:buffer')
    
    // Create a File from the buffer (Node.js 20+)
    const audioFile = new File([audioBuffer], `audio.${mimeType.split('/')[1] || 'mp3'}`, {
      type: mimeType,
    })

    // Call ElevenLabs Speech-to-Text API
    const transcription = await elevenlabs.speechToText.convert({
      file: audioFile,
      modelId: 'scribe_v1', // Model to use
      tagAudioEvents: true, // Tag audio events like laughter, applause, etc.
      languageCode: 'eng', // Language of the audio file
      diarize: true, // Whether to annotate who is speaking
    })

    const transcriptionDuration = Date.now() - transcriptionStartTime
    const transcriptText = transcription.text || ''

    console.log(`[ElevenLabs] Transcription completed in ${transcriptionDuration}ms`, {
      transcriptLength: transcriptText.length,
      languageCode: transcription.language_code,
      languageProbability: transcription.language_probability,
      wordCount: transcription.words?.length || 0,
      transcriptPreview: transcriptText.substring(0, 200),
    })

    return transcriptText
  } catch (error) {
    const transcriptionDuration = Date.now() - transcriptionStartTime
    console.error(
      `[ElevenLabs] Transcription failed after ${transcriptionDuration}ms:`,
      error,
    )
    throw error
  }
}

/**
 * Transcribe audio from a file path using ElevenLabs
 * @param filePath - Path to the audio file
 * @param mimeType - MIME type of the audio
 * @returns The transcribed text
 */
export async function transcribeAudioFileWithElevenLabs(
  filePath: string,
  mimeType: string = 'audio/mp3',
): Promise<string> {
  const fs = await import('node:fs/promises')
  const audioBuffer = await fs.readFile(filePath)
  return transcribeAudioWithElevenLabs(audioBuffer, mimeType)
}

