import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
} from '@google/genai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { env } from '@/env'

// Initialize with API key from environment
export const ai = new GoogleGenAI({
  apiKey: env.SERVER_GEMINI_API_KEY,
})

/**
 * Gemini supported audio formats
 * @see https://ai.google.dev/gemini-api/docs/audio
 */
export const GEMINI_SUPPORTED_AUDIO_FORMATS = [
  'audio/wav',
  'audio/mp3',
  'audio/aiff',
  'audio/aac',
  'audio/ogg', // OGG Vorbis
  'audio/flac',
] as const

/**
 * Check if a MIME type is supported by Gemini
 */
export function isGeminiSupportedFormat(mimeType: string): boolean {
  // Normalize mimeType (remove codecs parameter)
  const normalized = mimeType.split(';')[0].trim().toLowerCase()
  return GEMINI_SUPPORTED_AUDIO_FORMATS.some((format) => format === normalized)
}

/**
 * Transcribe audio buffer using Gemini Files API (writes to /tmp first)
 * This is more reliable for larger files and avoids base64 encoding overhead
 *
 * Note: Gemini supports: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC
 * WebM is not officially supported, but may work in some cases.
 * For best compatibility, consider converting to OGG or MP3.
 */
export async function transcribeAudioChunk(
  audioBuffer: Buffer, // Audio data as Buffer
  mimeType: string = 'audio/ogg', // Default to OGG - Gemini supports: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC (NOT WebM!)
): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const os = await import('node:os')

  // Normalize mimeType (remove codecs parameter for validation)
  let normalizedMimeType = mimeType.split(';')[0].trim()

  // MediaRecorder uses audio/mp4 for AAC, but Gemini expects audio/aac
  // Map MediaRecorder MIME types to Gemini-compatible MIME types
  if (normalizedMimeType === 'audio/mp4') {
    normalizedMimeType = 'audio/aac'
    console.log(
      `[Gemini] Mapped audio/mp4 to audio/aac for Gemini compatibility`,
    )
  }

  const isSupported = isGeminiSupportedFormat(normalizedMimeType)

  if (!isSupported) {
    console.warn(
      `[Gemini] Unsupported audio format: ${mimeType}. Supported formats: ${GEMINI_SUPPORTED_AUDIO_FORMATS.join(', ')}. Attempting anyway...`,
    )
  } else {
    console.log(
      `[Gemini] Transcribing audio with supported format: ${normalizedMimeType}`,
    )
  }

  const transcriptionStartTime = Date.now()
  console.log(`[Gemini] Starting transcription using Files API...`, {
    mimeType: normalizedMimeType,
    bufferSize: audioBuffer.length,
    isSupported,
  })

  // Determine file extension from MIME type
  // Gemini supports: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC (NOT WebM!)
  // Note: normalizedMimeType is already mapped (audio/mp4 -> audio/aac above)
  const extensionMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3', // MP3 (MediaRecorder uses audio/mpeg)
    'audio/mp3': 'mp3', // MP3 alternative
    'audio/aac': 'aac', // AAC (MediaRecorder's audio/mp4 is already mapped to audio/aac above)
    'audio/wav': 'wav',
    'audio/aiff': 'aiff',
    'audio/flac': 'flac',
  }
  const extension = extensionMap[normalizedMimeType] || 'mp3' // Default to MP3 (most universal)
  const tempFileName = `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`
  // Use /tmp explicitly for Vercel (os.tmpdir() might return different paths)
  const tempFilePath = path.join('/tmp', tempFileName)
  console.log(`[Gemini] Temp file path: ${tempFilePath}`)

  try {
    // Write audio buffer to temporary file
    console.log(`[Gemini] ===== Writing audio to temp file =====`)
    console.log(`[Gemini] Temp file path: ${tempFilePath}`)
    console.log(
      `[Gemini] Buffer size: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`,
    )
    const writeStartTime = Date.now()
    await fs.writeFile(tempFilePath, audioBuffer)
    const writeDuration = Date.now() - writeStartTime
    console.log(`[Gemini] ✓ Audio written to temp file in ${writeDuration}ms`)

    // Verify file was written
    const stats = await fs.stat(tempFilePath)
    console.log(`[Gemini] Temp file stats:`, {
      size: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
      created: stats.birthtime,
    })

    // Upload file to Gemini using Files API
    console.log(`[Gemini] ===== Uploading audio file to Gemini =====`)
    console.log(`[Gemini] File path: ${tempFilePath}`)
    console.log(`[Gemini] MIME type: ${normalizedMimeType}`)
    console.log(
      `[Gemini] File size: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`,
    )
    const uploadStartTime = Date.now()
    let myfile
    try {
      myfile = await ai.files.upload({
        file: tempFilePath,
        config: { mimeType: normalizedMimeType },
      })
    } catch (uploadError) {
      console.error(`[Gemini] ✗ File upload failed:`, uploadError)
      throw new Error(
        `Failed to upload audio file to Gemini: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
      )
    }

    const uploadDuration = Date.now() - uploadStartTime
    console.log(`[Gemini] ✓ File uploaded to Gemini in ${uploadDuration}ms`, {
      uri: myfile.uri,
      detectedMimeType: myfile.mimeType,
      fileSize: audioBuffer.length,
      fileSizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
    })

    if (!myfile.uri) {
      throw new Error('Failed to upload file to Gemini')
    }

    // Generate transcript using file URI
    const generateStartTime = Date.now()
    console.log(`[Gemini] Generating transcript from uploaded file...`, {
      uri: myfile.uri,
      mimeType: myfile.mimeType || normalizedMimeType,
    })
    let result
    try {
      result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: createUserContent([
          createPartFromUri(myfile.uri, myfile.mimeType || normalizedMimeType),
          'Please transcribe the audio file. Listen carefully to the actual speech in the audio and provide a word-for-word transcript of what is being said. Do not create a sample or example transcript - transcribe the actual audio content.',
        ]),
      })
    } catch (generateError) {
      console.error(`[Gemini] ✗ Content generation failed:`, generateError)
      throw new Error(
        `Failed to generate transcript from Gemini: ${generateError instanceof Error ? generateError.message : String(generateError)}`,
      )
    }

    console.log(`[Gemini] Raw response received`, {
      hasText: !!result.text,
      textLength: result.text?.length || 0,
      textPreview: result.text?.substring(0, 200) || 'No text',
    })

    const generateDuration = Date.now() - generateStartTime
    const transcript = result.text || ''
    const transcriptionDuration = Date.now() - transcriptionStartTime

    console.log(
      `[Gemini] Transcription completed in ${transcriptionDuration}ms (upload: ${uploadDuration}ms, generate: ${generateDuration}ms)`,
      {
        transcriptLength: transcript.length,
        preview: transcript.substring(0, 100),
      },
    )

    return transcript
  } catch (error) {
    const transcriptionDuration = Date.now() - transcriptionStartTime
    console.error(
      `[Gemini] Transcription failed after ${transcriptionDuration}ms:`,
      {
        mimeType: normalizedMimeType,
        error: error instanceof Error ? error.message : String(error),
        isSupported,
      },
    )
    throw error
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFilePath)
      console.log(`[Gemini] Cleaned up temp file: ${tempFilePath}`)
    } catch (cleanupError) {
      console.warn(
        `[Gemini] Failed to clean up temp file ${tempFilePath}:`,
        cleanupError,
      )
    }
  }
}

/**
 * Upload audio file to Gemini and transcribe it
 * Use this for complete audio files after streaming is done
 * @param filePath - Path to the audio file
 * @param mimeType - MIME type of the audio (e.g., 'audio/ogg', 'audio/mp3')
 *                    Gemini supports: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC (NOT WebM!)
 */
export async function transcribeAudioFile(
  filePath: string,
  mimeType: string = 'audio/ogg', // Default to OGG - Gemini does NOT support WebM!
): Promise<string> {
  let normalizedMimeType = mimeType.split(';')[0].trim()

  // MediaRecorder uses audio/mp4 for AAC, but Gemini expects audio/aac
  if (normalizedMimeType === 'audio/mp4') {
    normalizedMimeType = 'audio/aac'
  }

  const isSupported = isGeminiSupportedFormat(normalizedMimeType)

  if (!isSupported) {
    console.warn(
      `[Gemini] Unsupported audio format: ${mimeType}. Supported formats: ${GEMINI_SUPPORTED_AUDIO_FORMATS.join(', ')}. Attempting anyway...`,
    )
  }

  console.log(`[Gemini] Uploading audio file to Gemini...`, {
    filePath,
    mimeType: normalizedMimeType,
    isSupported,
  })

  const uploadStartTime = Date.now()

  // Upload file to Gemini
  const myfile = await ai.files.upload({
    file: filePath,
    config: { mimeType: normalizedMimeType },
  })

  const uploadDuration = Date.now() - uploadStartTime
  console.log(`[Gemini] File uploaded in ${uploadDuration}ms`, {
    uri: myfile.uri,
    detectedMimeType: myfile.mimeType,
  })

  // Generate transcript
  if (!myfile.uri) {
    throw new Error('Failed to upload file to Gemini')
  }

  const transcriptionStartTime = Date.now()
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: createUserContent([
      createPartFromUri(myfile.uri, myfile.mimeType || normalizedMimeType),
      'Generate a transcript of the speech.',
    ]),
  })

  const transcriptionDuration = Date.now() - transcriptionStartTime
  const transcript = result.text || ''
  console.log(
    `[Gemini] Transcription completed in ${transcriptionDuration}ms`,
    {
      transcriptLength: transcript.length,
    },
  )

  return transcript
}

/**
 * Transcribe audio from R2 file URI
 * Use this when you have the file already uploaded to R2
 * @param mimeType - MIME type (Gemini supports: WAV, MP3, AIFF, AAC, OGG Vorbis, FLAC - NOT WebM!)
 */
export async function transcribeAudioFromUri(
  fileUri: string,
  mimeType: string = 'audio/ogg', // Default to OGG - Gemini does NOT support WebM!
): Promise<string> {
  let normalizedMimeType = mimeType.split(';')[0].trim()

  // MediaRecorder uses audio/mp4 for AAC, but Gemini expects audio/aac
  if (normalizedMimeType === 'audio/mp4') {
    normalizedMimeType = 'audio/aac'
  }

  const isSupported = isGeminiSupportedFormat(normalizedMimeType)

  if (!isSupported) {
    console.warn(
      `[Gemini] Unsupported audio format: ${mimeType}. Supported formats: ${GEMINI_SUPPORTED_AUDIO_FORMATS.join(', ')}. Attempting anyway...`,
    )
  }

  console.log(`[Gemini] Transcribing audio from URI...`, {
    uri: fileUri,
    mimeType: normalizedMimeType,
    isSupported,
  })

  const transcriptionStartTime = Date.now()
  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: createUserContent([
      createPartFromUri(fileUri, normalizedMimeType),
      'Generate a transcript of the speech.',
    ]),
  })

  const transcriptionDuration = Date.now() - transcriptionStartTime
  const transcript = result.text || ''
  console.log(
    `[Gemini] Transcription completed in ${transcriptionDuration}ms`,
    {
      transcriptLength: transcript.length,
    },
  )

  return transcript
}

/**
 * Analyze sentiment from transcript using structured outputs
 */
const sentimentSchema = z.object({
  sentiment: z
    .enum(['positive', 'neutral', 'negative'])
    .describe('The overall sentiment of the feedback'),
})

export async function analyzeSentiment(
  transcript: string,
): Promise<'positive' | 'neutral' | 'negative'> {
  console.log(`[Gemini] ===== Analyzing sentiment =====`)
  console.log(`[Gemini] Transcript length: ${transcript.length}`)
  console.log(`[Gemini] Transcript preview: ${transcript.substring(0, 200)}`)

  const prompt = `Analyze the sentiment of the following customer feedback transcript. Classify it as positive, neutral, or negative based on the overall tone and content.

Transcript: ${transcript}`

  const analysisStartTime = Date.now()
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      // @ts-expect-error - zod-to-json-schema type compatibility issue
      responseJsonSchema: zodToJsonSchema(sentimentSchema, {
        target: 'openApi3',
      }),
    },
  })

  const analysisDuration = Date.now() - analysisStartTime
  console.log(
    `[Gemini] Sentiment analysis response received in ${analysisDuration}ms`,
  )

  if (!response.text) {
    console.error(`[Gemini] ✗ No response text from Gemini`)
    throw new Error('Failed to get response from Gemini')
  }

  console.log(`[Gemini] Raw response text:`, {
    text: response.text,
    textLength: response.text.length,
  })

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(response.text)
    console.log(`[Gemini] Parsed JSON:`, parsed)
    const result = sentimentSchema.parse(parsed)
    console.log(`[Gemini] ✓ Sentiment extracted: ${result.sentiment}`)
    return result.sentiment
  } catch (parseError) {
    console.error(`[Gemini] ✗ Failed to parse sentiment response:`, {
      responseText: response.text,
      error:
        parseError instanceof Error ? parseError.message : String(parseError),
    })

    // Fallback: try to extract sentiment from text response
    const lowerText = response.text.toLowerCase()
    if (lowerText.includes('positive')) {
      console.log(`[Gemini] Fallback: Detected 'positive' from text`)
      return 'positive'
    } else if (lowerText.includes('negative')) {
      console.log(`[Gemini] Fallback: Detected 'negative' from text`)
      return 'negative'
    } else {
      console.log(`[Gemini] Fallback: Defaulting to 'neutral'`)
      return 'neutral'
    }
  }
}

/**
 * Extract customer name from transcript if not provided
 */
const nameExtractionSchema = z.object({
  name: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The customer's name if mentioned in the transcript, otherwise null or undefined",
    ),
})

export async function extractNameFromTranscript(
  transcript: string,
): Promise<string | null> {
  const prompt = `Extract the customer's name from the following feedback transcript. If the customer introduces themselves or mentions their name, extract it. If no name is mentioned, return null.

Transcript: ${transcript}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      // @ts-expect-error - zod-to-json-schema type compatibility issue
      responseJsonSchema: zodToJsonSchema(nameExtractionSchema, {
        target: 'openApi3',
      }),
    },
  })

  if (!response.text) {
    throw new Error('Failed to get response from Gemini')
  }

  try {
    const parsed = JSON.parse(response.text)
    const result = nameExtractionSchema.parse(parsed)
    return result.name ?? null
  } catch (error) {
    console.error('[Gemini] Error parsing name extraction response:', {
      responseText: response.text,
      error: error instanceof Error ? error.message : String(error),
    })
    // Return null if parsing fails
    return null
  }
}

// Explicit export to ensure this file is treated as a module
export {}
