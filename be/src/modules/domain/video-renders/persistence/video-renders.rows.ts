/** One render delivery taken by the job. */
export interface ClaimedRenderRow {
    /** The render id. */
    readonly id: string
    /** The workspace the render belongs to. */
    readonly workspace_id: string
    /** The spec stored with the render. */
    readonly spec: unknown
    /** How many deliveries took this render, this one included. */
    readonly attempts: number
}

/** The answer of `COUNT_OPEN_RENDERS`. */
export interface OpenRendersRow {
    /** Renders waiting or running. */
    readonly open: number
}

/** The answer of `INSERT_RENDER`. */
export interface InsertedRenderRow {
    /** The new render id. */
    readonly id: string
}

/** The workspace-scoped progress and output of a render. */
export interface RenderStatusRow {
    /** The render id. */
    readonly id: string
    /** The stored render lifecycle state. */
    readonly status: "queued" | "rendering" | "done" | "failed"
    /** The completed percentage. */
    readonly progress: number
    /** The renderer stage code. */
    readonly stage: string | null
    /** The video output path. */
    readonly output_path: string | null
    /** The poster output path. */
    readonly poster_path: string | null
    /** The video duration. */
    readonly duration_ms: number | null
    /** PostgreSQL bigint output may be returned as text. */
    readonly size_bytes: number | string | null
}

/** One finished render offered as content media. */
export interface CompletedRenderMediaRow {
    /** The render id. */
    readonly id: string
    /** The project title or fallback brand name. */
    readonly title: string
    /** The non-null video output path. */
    readonly output_path: string
    /** The video duration, when recorded. */
    readonly duration_ms: number | null
    /** When the render was queued. */
    readonly created_at: Date | string
}
