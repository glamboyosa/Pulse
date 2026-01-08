import { readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Decoder, Demuxer, Encoder, Muxer, pipeline } from 'node-av/api'
import { FF_ENCODER_PCM_S16LE } from 'node-av/constants'

/**
 * Convert audio buffer from one format to another using node-av
 * @param inputBuffer - Input audio buffer
 * @param inputFormat - Input MIME type (e.g., 'audio/webm')
 * @param outputFormat - Output MIME type (e.g., 'audio/mp3')
 * @returns Promise<Buffer> - Converted audio buffer
 */
export async function convertAudioFormat(
  inputBuffer: Buffer,
  inputFormat: string,
  outputFormat: string,
): Promise<Buffer> {
  console.log(
    `[Audio Convert] Converting audio: ${inputFormat} -> ${outputFormat}`,
    {
      inputSize: inputBuffer.length,
      inputSizeMB: (inputBuffer.length / 1024 / 1024).toFixed(2),
    },
  )

  const conversionStartTime = Date.now()

  // Extract format names and determine file extensions
  const inputFormatName = inputFormat.split(';')[0].split('/')[1] // 'webm' from 'audio/webm'
  const outputFormatName = outputFormat.split(';')[0].split('/')[1] // 'mp3' from 'audio/mp3'

  // Determine encoder based on output format
  // For WAV, we use PCM S16LE (16-bit signed little-endian PCM)
  let encoderName: typeof FF_ENCODER_PCM_S16LE
  if (outputFormatName === 'wav') {
    encoderName = FF_ENCODER_PCM_S16LE
  } else {
    throw new Error(
      `Unsupported output format: ${outputFormatName}. Only WAV is supported.`,
    )
  }

  console.log(
    `[Audio Convert] Using encoder: ${encoderName} for format: ${outputFormatName}`,
  )

  // Create temp file paths
  const inputTempFile = join(
    '/tmp',
    `audio-input-${Date.now()}-${Math.random().toString(36).substring(7)}.${inputFormatName}`,
  )
  const outputTempFile = join(
    '/tmp',
    `audio-output-${Date.now()}-${Math.random().toString(36).substring(7)}.${outputFormatName}`,
  )

  try {
    // Write input buffer to temp file
    console.log(`[Audio Convert] Writing input to temp file: ${inputTempFile}`)
    await writeFile(inputTempFile, inputBuffer)

    // Open Demuxer for input
    console.log(`[Audio Convert] Opening demuxer...`)
    await using input = await Demuxer.open(inputTempFile)

    // Get audio stream
    const audioStream = input.audio()
    if (!audioStream) {
      throw new Error('No audio stream found in input file')
    }
    console.log(
      `[Audio Convert] Found audio stream at index: ${audioStream.index}`,
    )

    // Create decoder
    console.log(`[Audio Convert] Creating decoder...`)
    using decoder = await Decoder.create(audioStream)

    // Create encoder with settings
    // PCM is uncompressed, so no bitrate needed
    console.log(`[Audio Convert] Creating encoder...`)
    using encoder = await Encoder.create(encoderName, {
      decoder, // Copy settings from decoder
    })

    // Open Muxer for output
    console.log(`[Audio Convert] Opening muxer for output: ${outputTempFile}`)
    await using output = await Muxer.open(outputTempFile, {
      input, // Copy global headers and metadata
    })

    // Add stream to output
    const outputIndex = output.addStream(encoder, {
      inputStream: audioStream, // Copy settings from input stream
    })
    console.log(
      `[Audio Convert] Added stream to output at index: ${outputIndex}`,
    )

    // Create and run pipeline
    console.log(`[Audio Convert] Starting pipeline...`)
    const control = pipeline(input, decoder, encoder, output)
    await control.completion
    console.log(`[Audio Convert] Pipeline completed`)

    // Read output file
    console.log(`[Audio Convert] Reading output file...`)
    const outputBuffer = await readFile(outputTempFile)
    const conversionDuration = Date.now() - conversionStartTime

    console.log(
      `[Audio Convert] ✓ Conversion completed in ${conversionDuration}ms`,
      {
        outputSize: outputBuffer.length,
        outputSizeMB: (outputBuffer.length / 1024 / 1024).toFixed(2),
        inputSize: inputBuffer.length,
        inputSizeMB: (inputBuffer.length / 1024 / 1024).toFixed(2),
        compressionRatio:
          outputBuffer.length < inputBuffer.length
            ? ((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(
                2,
              ) + '%'
            : 'N/A (larger)',
      },
    )

    return outputBuffer
  } catch (error) {
    console.error(`[Audio Convert] ✗ Conversion failed:`, {
      error: error instanceof Error ? error.message : String(error),
      inputFormat,
      outputFormat,
    })
    throw error
  } finally {
    // Clean up temp files
    try {
      await unlink(inputTempFile).catch(() => {
        // Ignore errors if file doesn't exist
      })
      await unlink(outputTempFile).catch(() => {
        // Ignore errors if file doesn't exist
      })
      console.log(`[Audio Convert] Cleaned up temp files`)
    } catch (cleanupError) {
      console.warn(
        `[Audio Convert] Failed to clean up temp files:`,
        cleanupError,
      )
    }
  }
}

/**
 * Convert WebM audio to WAV (Gemini-supported format, uncompressed PCM)
 * @param webmBuffer - WebM audio buffer
 * @returns Promise<Buffer> - WAV audio buffer
 */
export async function convertWebmToWav(webmBuffer: Buffer): Promise<Buffer> {
  console.log(`[Audio Convert] Converting WebM to WAV...`, {
    inputSize: webmBuffer.length,
  })
  return convertAudioFormat(webmBuffer, 'audio/webm', 'audio/wav')
}
