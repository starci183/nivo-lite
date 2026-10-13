/** The most renders a workspace may have waiting or running at once: a render is minutes of CPU on a shared host. */
export const MAX_OPEN_RENDERS = 3

/** A render to queue. */
export interface NewRender {
    /** The workspace the render belongs to. */
    readonly workspaceId: string
    /** The validated spec as JSON text. */
    readonly spec: string
    /** The person who asked for it. */
    readonly createdBy: string
}

/** One delivery of a render job, taken from the queue. */
export interface ClaimedRender {
    /** The render row. */
    readonly renderId: string
    /** The workspace it belongs to. */
    readonly workspaceId: string
    /** The spec stored with the render, not yet validated. */
    readonly spec: unknown
    /** How many deliveries took this render, this one included. */
    readonly attempts: number
}

/** What a finished render keeps on its row. */
export interface RenderDone {
    /** The MP4 path in the `videos` bucket. */
    readonly outputPath: string
    /** The poster path in the `videos` bucket. */
    readonly posterPath: string
    /** Real length of the video in milliseconds. */
    readonly durationMs: number
    /** Size of the MP4 in bytes. */
    readonly sizeBytes: number
    /** What the render did, merged into the row's meta. */
    readonly meta: object
}

/** The answer of taking a render delivery: the render, or null when it is already settled or does not exist. */
export type RenderClaim = ClaimedRender | null
