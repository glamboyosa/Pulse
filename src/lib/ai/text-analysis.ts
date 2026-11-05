import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import { env } from '@/env'

type Sentiment = 'positive' | 'neutral' | 'negative'

// OpenAI first; OpenRouter serves the same model when OpenAI is down or out of credit.
const models = [
  env.OPENAI_API_KEY &&
    createOpenAI({ apiKey: env.OPENAI_API_KEY })('gpt-5-mini'),
  env.OPENROUTER_API_KEY &&
    createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })('openai/gpt-5-mini'),
].filter((model) => !!model)

const generateObject = async <T>(
  schema: z.ZodType<T>,
  prompt: string,
): Promise<T> => {
  let lastError: unknown = new Error('No OpenAI or OpenRouter API key is set')
  for (const model of models) {
    try {
      // A hung provider must not run the request past its time limit: the
      // transcript is only saved after this returns.
      const { output } = await generateText({
        model,
        output: Output.object({ schema }),
        prompt,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(20_000),
      })
      return output
    } catch (error) {
      console.error(`[AI] ${model.provider} failed, trying the next one`, error)
      lastError = error
    }
  }
  throw lastError
}

/**
 * Classifies the feedback's tone. Returns null when every provider fails, so a
 * transcript is still saved without a sentiment.
 */
export async function analyzeSentiment(
  transcript: string,
): Promise<Sentiment | null> {
  try {
    const { sentiment } = await generateObject(
      z.object({ sentiment: z.enum(['positive', 'neutral', 'negative']) }),
      `Analyze the sentiment of the following customer feedback transcript. Classify it as positive, neutral, or negative based on the overall tone and content.

Transcript: ${transcript}`,
    )
    return sentiment
  } catch (error) {
    console.error('[AI] Sentiment analysis failed', error)
    return null
  }
}

/** Returns the customer's name if they say it in the transcript, otherwise null. */
export async function extractNameFromTranscript(
  transcript: string,
): Promise<string | null> {
  const { name } = await generateObject(
    z.object({ name: z.string().nullable() }),
    `Extract the customer's name from the following feedback transcript. If the customer introduces themselves or mentions their name, extract it. If no name is mentioned, return null.

Transcript: ${transcript}`,
  )
  return name
}
