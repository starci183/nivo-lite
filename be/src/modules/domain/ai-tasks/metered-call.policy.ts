import type { AiServed, AiUsage } from "@modules/integrations/ai"
import type { MeteredCall } from "./ai-tasks.contracts"
import type { ModelFacts } from "./model-choice.policy"

/**
 * What an answered model call was and how it went, as the meter books it beside its cost: the call kind (a graph node's `purpose`,
 * null for a fixed task), the hidden reasoning of its usage, which try answered, and the upstream, finish reason and time of that
 * try when the endpoint said (or the call was timed), and, for a graph node's call, what model it declared, the provider that served
 * it and why the call went to that model.
 */
export const meteredCallOf = (
    purpose: string | undefined,
    usage: AiUsage,
    tryNumber: number,
    served: AiServed | undefined,
    model: ModelFacts | null = null,
): MeteredCall => ({
    purpose: purpose ?? null,
    reasoningTokens: usage.reasoningTokens ?? null,
    durationMs: served?.durationMs ?? null,
    tryNumber,
    upstream: served?.upstream ?? null,
    finishReason: served?.finishReason ?? null,
    ...(model === null
        ? {}
        : {
              declaredModel: model.declaredModel,
              ...(model.modelProvider === null ? {} : { modelProvider: model.modelProvider }),
              modelReason: model.modelReason,
          }),
})
