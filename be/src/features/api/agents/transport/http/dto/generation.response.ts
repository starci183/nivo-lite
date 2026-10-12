/** What a run cost. */
export class GenerationUsageResponse {
    /** Prompt tokens, cached ones included. */
    prompt_tokens!: number
    /** Completion tokens. */
    completion_tokens!: number
    /** Prompt tokens served from the cache. */
    cached_tokens!: number
    /** The provider cost of the run. */
    cost!: number
    /** Who served the run, `provider/model`. */
    model!: string | null
}

/** The result of one generation: the text, or the reason there is none and the sentence to show. */
export class GenerationResponse {
    /** True when the engine produced text; the members below belong to the half this selects. */
    ok!: boolean
    /** The generated text; present on success. */
    output?: string
    /** The generation row; present on success. */
    generationId?: string
    /** Milliseconds from the start of the run to each named mark; present on success. */
    timings?: Record<string, number>
    /** What the run cost; null when the gateway reported none; present on success. */
    usage?: GenerationUsageResponse | null
    /** `quota`, `engine_offline`, `timeout`, `error` or `not_configured`; present on failure. */
    reason?: string
    /** The sentence to show, in the request language; present on failure. */
    message?: string
}
