import type { AiChatAttempt, AiFailure, AiServed, AiUsage } from "./ai.contracts"

/** What one try of a chat call spent, as a meter books it: the model that served it, its usage and the characters it wrote. */
export interface AiTrySpend {
    /** The model that served the try. */
    readonly model: string
    /** What the endpoint reported for it. */
    readonly usage: AiUsage
    /** The characters of the answer the caller got: 0 for a try cut at its cap or answered empty. */
    readonly completionChars: number
    /**
     * Set for a try that gave no usable answer (cut at its cap, answered empty): the meter books it with the provider's own figures
     * and never bills it. Absent for an answer.
     */
    readonly failure?: AiFailure | undefined
    /**
     * Which upstream served the try, why the model stopped (`end_turn`, `stop`; `length` / `max_tokens` on a cut try) and how long it
     * took, as the endpoint said: booked on the row with the figures. Absent when the try did not say.
     */
    readonly served?: AiServed | undefined
}

/** The served facts of a try as a field, or no field when the try did not say. */
const servedOf = (served: AiServed | undefined): Pick<AiTrySpend, "served"> => (served === undefined ? {} : { served })

/** What a try spent, or null when it returned nothing. */
export type MaybeTrySpend = AiTrySpend | null

/**
 * What a try spent when it returned tokens, whatever its finish reason (concept.tokens-and-credits): an answer with its usage (billed),
 * and a try cut at the token cap or answered empty with what it still reported and its `failure` (booked with its real tokens, never
 * billed: a try that gave no usable answer is a failed try, and only the try that answers is charged to the shop's pool). Null for a try
 * that returned nothing (no key, a timeout, a provider error): there is nothing to book. The ONE reading of a try for the meters, so
 * every call site books each try that returned tokens exactly once, under the same billing rule.
 */
export const spendOf = (tried: AiChatAttempt): MaybeTrySpend => {
    if (tried.ok)
        return {
            model: tried.answer.model,
            usage: tried.answer.usage,
            completionChars: tried.answer.text.length,
            ...servedOf(tried.answer.served),
        }
    return tried.spent === undefined
        ? null
        : {
              model: tried.spent.model,
              usage: tried.spent.usage,
              completionChars: 0,
              failure: tried.failure,
              ...servedOf(tried.spent.served),
          }
}
