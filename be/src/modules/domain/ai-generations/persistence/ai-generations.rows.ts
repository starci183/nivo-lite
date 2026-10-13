/** public.ai_generations as the runner reads it. */
export interface GenerationRow {
    /** The generation. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** What the text is for. */
    purpose: string
    /** The usage module. */
    module: string
    /** The usage kind. */
    usage_kind: string
    /** Constrained by a CHECK in the table. */
    status: string
    /** The prompt: messages, response_format, timeout_ms. */
    input: unknown
}

/** The part of public.ai_generations a caller polls. */
export interface GenerationProgressRow {
    /** queued, running, done, error or cancelled. */
    status: string
    /** The output: { text }. */
    output: unknown
    /** The usage the run reported. */
    usage: unknown
    /** The marks the run reported. */
    timings: unknown
}

/** The id a generation insert answers. */
export interface InsertedGenerationRow {
    /** The new generation. */
    id: string
}

/** The metering fields a finished generation answers. */
export interface FinishedGenerationRow {
    /** The usage kind. */
    usage_kind: string
    /** The usage module. */
    module: string
}

/** Full generation state used by application completion steps. */
export interface GenerationStateRow extends GenerationRow, GenerationProgressRow {
    /** The stored engine or application failure. */
    error: string | null
    /** Creation instant. */
    created_at: string | Date
    /** Completion instant. */
    finished_at: string | Date | null
}

/** How many guide questions a member asked in the window. */
export interface GuideAskCountRow {
    /** The count, as Postgres answers a bigint. */
    readonly asked: string
}
