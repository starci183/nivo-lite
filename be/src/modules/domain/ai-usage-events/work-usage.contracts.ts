/** The model use of one step (graph node key) of an agent's graph over a window: what the graph read shows on each AI node. */
export interface AgentStepUsage {
    /** The step (graph node key). */
    readonly stepKey: string
    /** The runs that called a model in this step. */
    readonly runs: number
    /** The answered calls. */
    readonly calls: number
    /** The failed tries (estimated, never billed). */
    readonly failedTries: number
    /** The exact cost of the answers in USD. */
    readonly costUsd: number
    /** The exact price of the failed tries in USD. */
    readonly failedCostUsd: number
    /** The credits of the answers, a fraction. */
    readonly credits: number
    /** The credits of one run on average (`credits / runs`), a fraction; 0 when no run. */
    readonly creditsPerRun: number
    /** The average wall time of an answered call, milliseconds; null when none was measured. */
    readonly averageMs: number | null
    /** The models that served the calls, sorted, without repeats. */
    readonly models: ReadonlyArray<string>
}

/** The model use of one record (a document, a lesson) for one kind of work. */
export interface WorkKindUsage {
    /** The record, `<what>:<id>`. */
    readonly ref: string
    /** The kind of work (`document_read`, `document_reread`, `document_critique`, `learning`, ...). */
    readonly workKind: string
    /** The answered calls. */
    readonly calls: number
    /** The failed tries. */
    readonly failedTries: number
    /** Prompt and completion tokens of the answers. */
    readonly tokens: number
    /** The exact cost of the answers in USD. */
    readonly costUsd: number
    /** The exact price of the failed tries in USD. */
    readonly failedCostUsd: number
    /** The credits of the answers, a fraction. */
    readonly credits: number
    /** The models that served the calls, sorted, without repeats. */
    readonly models: ReadonlyArray<string>
}

/** One day's use of one module for one kind of work: the workspace summary of the last days. */
export interface DailyWorkUsage {
    /** The day in Vietnam time, YYYY-MM-DD. */
    readonly day: string
    /** The module or shared usage bucket. */
    readonly module: string
    /** The kind of work; a call booked without one is grouped under its usage kind. */
    readonly workKind: string
    /** The answered calls. */
    readonly calls: number
    /** The failed tries. */
    readonly failedTries: number
    /** Prompt and completion tokens of the answers. */
    readonly tokens: number
    /** The exact cost of the answers in USD. */
    readonly costUsd: number
    /** The exact price of the failed tries in USD. */
    readonly failedCostUsd: number
    /** The credits of the answers, a fraction (the bill rounds the month's total, never a day). */
    readonly credits: number
}

/** The model use of one kind of work, exact: what a document, a lesson or a turn cost. */
export interface WorkCost {
    /** Answered calls. */
    readonly calls: number
    /** Failed tries (estimated, never billed). */
    readonly failedTries: number
    /** Prompt and completion tokens of the answers. */
    readonly tokens: number
    /** The exact cost of the answers in USD. */
    readonly costUsd: number
    /** The credits of the answers, an exact fraction. */
    readonly credits: number
    /** The price of the failed tries in USD. */
    readonly failedCostUsd: number
    /** The credits of the failed tries, an exact fraction. */
    readonly failedCredits: number
}

/** What one document of Second Brain cost: to read it, to critique it, to read it again; and in all. */
export interface DocumentAiCost {
    /** Its first reading: transcription, passage vectors, facts, same-fact judgements, fact vectors, relations. */
    readonly read: WorkCost
    /** Its critique (the deep critic at upload and later uploads). */
    readonly critique: WorkCost
    /** Every later reading of a changed document. */
    readonly reread: WorkCost
    /** All of it. */
    readonly total: WorkCost
    /** The models that served its calls, sorted. */
    readonly models: ReadonlyArray<string>
}
