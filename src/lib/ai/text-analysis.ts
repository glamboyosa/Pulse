import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import { env } from '@/env'

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

const analysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  customerName: z
    .string()
    .nullable()
    .describe('The name the customer says they have, or null'),
  language: z
    .string()
    .describe('The language spoken, in English, e.g. "Nigerian Pidgin"'),
  englishTranslation: z
    .string()
    .nullable()
    .describe('A faithful English translation, or null if already English'),
  summary: z
    .string()
    .describe('One short sentence an owner can act on, in English'),
  // Capped in code, not here: a fifth theme shouldn't throw away the analysis.
  themes: z
    .array(z.string())
    .describe(
      'One to four short lowercase topics, e.g. "wait time", "food quality", "staff friendliness"',
    ),
})

export type FeedbackAnalysis = z.infer<typeof analysisSchema>

/**
 * Reads a transcript in any language and returns what the owner needs:
 * tone, the customer's name, an English translation, a summary and themes.
 * One call, so a recording costs one model request.
 */
export const analyseTranscript = (
  transcript: string,
): Promise<FeedbackAnalysis> =>
  generateObject(
    analysisSchema,
    `You analyse voice feedback a customer left for a business, transcribed by speech-to-text.

Sentiment is the overall verdict: mixed feedback with a real complaint is negative. Keep themes consistent between recordings: reuse plain topics like "wait time", "food quality", "service", "price", "cleanliness", "atmosphere", "staff friendliness".

Transcript:
${transcript}`,
  )
