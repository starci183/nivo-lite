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
