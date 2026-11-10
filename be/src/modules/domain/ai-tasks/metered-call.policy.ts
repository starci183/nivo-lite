import type { AiServed, AiUsage } from "@modules/integrations/ai"
import type { MeteredCall } from "./ai-tasks.contracts"

/**
 * What an answered model call was and how it went, as the meter books it beside its cost: the call kind (a graph node's `purpose`,
 * null for a fixed task), the hidden reasoning of its usage, which try answered, and the upstream, finish reason and time of that
 * try when the endpoint said (or the call was timed).
 */
export const meteredCallOf = (
    purpose: string | undefined,
    usage: AiUsage,
    tryNumber: number,
    served: AiServed | undefined,
): MeteredCall => ({
    purpose: purpose ?? null,
    reasoningTokens: usage.reasoningTokens ?? null,
    durationMs: served?.durationMs ?? null,
    tryNumber,
    upstream: served?.upstream ?? null,
    finishReason: served?.finishReason ?? null,
})
