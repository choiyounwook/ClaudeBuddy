// Anthropic 공식 단가 (USD per 1M tokens, 2025-04 기준)
const PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-opus-4-6':    { input: 15,   output: 75,   cacheWrite: 18.75, cacheRead: 1.5  },
  'claude-sonnet-4-6':  { input: 3,    output: 15,   cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheWrite: 1,  cacheRead: 0.08 },
}

const DEFAULT_PRICE = PRICING['claude-sonnet-4-6']

export function calcCost(
  model: string | null,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): number {
  const price = (model && PRICING[model]) ? PRICING[model] : DEFAULT_PRICE
  const M = 1_000_000
  return (
    (inputTokens / M) * price.input +
    (outputTokens / M) * price.output +
    (cacheCreationTokens / M) * price.cacheWrite +
    (cacheReadTokens / M) * price.cacheRead
  )
}
