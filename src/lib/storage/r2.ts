import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/env'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID || '',
    secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: false,
  maxAttempts: 3,
  retryMode: 'adaptive',
})

const BUCKET_NAME = env.CLOUDFLARE_R2_BUCKET_NAME || 'pulse-audio'

/**
 * Upload audio chunk to R2
 * @param key - Unique key for the file (e.g., "feedback/{userId}/{feedbackId}/chunk-{index}.webm")
 * @param audioBuffer - Audio data as Buffer
 * @param mimeType - MIME type of the audio
 */
export async function uploadAudioChunk(
  key: string,
  audioBuffer: Buffer,
  mimeType: string = 'audio/webm',
): Promise<string> {
  const uploadStartTime = Date.now()
  console.log(`[R2 Upload] Starting upload to R2:`, {
    key,
    bucket: BUCKET_NAME,
    size: audioBuffer.length,
    mimeType,
  })

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: audioBuffer,
        ContentType: mimeType,
      }),
    )

    const uploadDuration = Date.now() - uploadStartTime
    console.log(`[R2 Upload] Upload successful:`, {
      key,
      duration: `${uploadDuration}ms`,
      size: audioBuffer.length,
    })

    return key
  } catch (error) {
    const uploadDuration = Date.now() - uploadStartTime
    console.error(`[R2 Upload] Upload failed after ${uploadDuration}ms:`, {
      key,
      bucket: BUCKET_NAME,
      size: audioBuffer.length,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * Get a presigned URL for reading an audio file
 * @param key - The key of the file in R2
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function getAudioUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }),
    { expiresIn },
  )

  return url
}

/**
 * Download audio chunk from R2
 * @param key - The key of the file in R2
 * @returns Buffer containing the audio data
 */
export async function downloadAudioChunk(key: string): Promise<Buffer> {
  console.log(`[R2 Download] Downloading chunk from R2:`, { key })
  const downloadStartTime = Date.now()

  try {
    const response = await r2.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
    )

    if (!response.Body) {
      throw new Error('No body in R2 response')
    }

    // Convert stream to buffer
    const chunks: Array<Uint8Array> = []
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const downloadDuration = Date.now() - downloadStartTime
    console.log(`[R2 Download] Download successful:`, {
      key,
      duration: `${downloadDuration}ms`,
      size: buffer.length,
    })

    return buffer
  } catch (error) {
    const downloadDuration = Date.now() - downloadStartTime
    console.error(
      `[R2 Download] Download failed after ${downloadDuration}ms:`,
      {
        key,
        error: error instanceof Error ? error.message : String(error),
      },
    )
    throw error
  }
}

/**
 * Download and combine all audio chunks for a feedback recording
 * @param userId - User ID
 * @param feedbackId - Feedback ID
 * @param totalChunks - Total number of chunks to download
 * @returns Combined audio buffer
 */
export async function downloadAndCombineChunks(
  userId: string,
  feedbackId: string,
  totalChunks: number,
): Promise<Buffer> {
  console.log(
    `[R2 Download] Downloading and combining ${totalChunks} chunks...`,
    {
      userId,
      feedbackId,
    },
  )

  const combineStartTime = Date.now()
  const chunks: Array<Buffer> = []

  // Download all chunks in parallel, but skip missing chunks
  const downloadPromises = Array.from({ length: totalChunks }, async (_, i) => {
    const chunkKey = generateFeedbackAudioKey(userId, feedbackId, i)
    try {
      return await downloadAudioChunk(chunkKey)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Check if it's a "key does not exist" error
      if (
        errorMessage.includes('does not exist') ||
        errorMessage.includes('NoSuchKey') ||
        errorMessage.includes('not found')
      ) {
        console.warn(
          `[R2 Download] Chunk ${i} not found, skipping: ${chunkKey}`,
        )
        return null // Return null for missing chunks
      }
      // Re-throw other errors
      throw error
    }
  })

  const downloadedChunks = await Promise.all(downloadPromises)
  // Filter out null values (missing chunks)
  const validChunks = downloadedChunks.filter(
    (chunk): chunk is Buffer => chunk !== null,
  )
  chunks.push(...validChunks)

  if (chunks.length === 0) {
    throw new Error(
      `No valid chunks found for feedback ${feedbackId}. Expected ${totalChunks} chunks, found 0.`,
    )
  }

  if (chunks.length < totalChunks) {
    console.warn(
      `[R2 Download] Only found ${chunks.length} of ${totalChunks} chunks. Continuing with available chunks.`,
    )
  }

  // Combine all chunks
  const combinedBuffer = Buffer.concat(chunks)
  const combineDuration = Date.now() - combineStartTime

  console.log(`[R2 Download] Combined ${chunks.length} chunks:`, {
    totalSize: combinedBuffer.length,
    duration: `${combineDuration}ms`,
    expectedChunks: totalChunks,
    actualChunks: chunks.length,
  })

  return combinedBuffer
}

/**
 * Generate a unique key for feedback audio
 * @param userId - User ID
 * @param feedbackId - Feedback ID
 * @param chunkIndex - Optional chunk index (for streaming chunks)
 * @param extension - File extension (default: 'webm')
 */
export function generateFeedbackAudioKey(
  userId: string,
  feedbackId: string,
  chunkIndex?: number,
  extension: string = 'webm',
): string {
  if (chunkIndex !== undefined) {
    return `feedback/${userId}/${feedbackId}/chunk-${chunkIndex}.webm`
  }
  return `feedback/${userId}/${feedbackId}/audio.${extension}`
}
