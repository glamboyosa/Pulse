import {
  DeleteObjectCommand,
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

// Local development shares the bucket, so its recordings live under dev/.
export const AUDIO_KEY_PREFIX =
  process.env.NODE_ENV === 'production' ? '' : 'dev/'

export async function uploadAudio(
  key: string,
  audio: Buffer,
  contentType: string,
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: audio,
      ContentType: contentType,
    }),
  )
}

export async function deleteAudio(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
}

/** A presigned URL for playing an audio file, valid for `expiresIn` seconds. */
export async function getAudioUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    { expiresIn },
  )
}

export async function downloadAudio(
  key: string,
): Promise<{ buffer: Buffer; type: string }> {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
  )
  if (!response.Body) throw new Error(`No audio stored at ${key}`)
  const bytes = await response.Body.transformToByteArray()
  return {
    buffer: Buffer.from(bytes),
    type: response.ContentType || 'audio/mp4',
  }
}
