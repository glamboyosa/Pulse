export type Sentiment = 'positive' | 'neutral' | 'negative'

/** Colour plus a word, so sentiment never relies on colour alone. */
export const SENTIMENT_STYLE: Record<
  Sentiment,
  { label: string; className: string }
> = {
  positive: { label: 'Happy', className: 'bg-positive text-white' },
  neutral: { label: 'Neutral', className: 'bg-neutral' },
  negative: { label: 'Unhappy', className: 'bg-negative text-white' },
}

export const isSentiment = (value: string | null): value is Sentiment =>
  value === 'positive' || value === 'neutral' || value === 'negative'
