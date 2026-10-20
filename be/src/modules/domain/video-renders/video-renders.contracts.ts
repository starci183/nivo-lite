/** The most renders a workspace may have waiting or running at once: a render is minutes of CPU on a shared host. */
export const MAX_OPEN_RENDERS = 3

/** A render to queue. */
export interface NewRender {
    /** The workspace the render belongs to. */
    readonly workspaceId: string
    /** The validated spec as JSON text. */
    readonly spec: string
    /** The person who asked for it, or null when an agent did (AI Editor on a delegated script). */
    readonly createdBy: string | null
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

/** The progress and output a workspace member can poll without internal failure text. */
export interface RenderStatus {
    /** The queued render id. */
    readonly id: string
    /** The job state exposed to the browser. */
    readonly status: "queued" | "running" | "succeeded" | "failed"
    /** The completed share of the render, from zero through one hundred. */
    readonly progress: number
    /** The render stage code, when running. */
    readonly stage: string | null
    /** The finished MP4 path in the videos bucket. */
    readonly outputPath: string | null
    /** The finished poster path in the videos bucket. */
    readonly posterPath: string | null
    /** The finished video duration in milliseconds. */
    readonly durationMs: number | null
    /** The finished MP4 size in bytes. */
    readonly sizeBytes: number | null
    /** A stable failure code; internal renderer messages are never exposed. */
    readonly errorCode: string | null
}

/** The render to read inside a member's selected workspace. */
export interface RenderStatusSelection {
    /** The selected workspace. */
    readonly workspaceId: string
    /** The queued render id. */
    readonly id: string
}

/** A completed workspace render that content may attach to a publication. */
export interface CompletedRenderMedia {
    /** The render id. */
    readonly id: string
    /** The project title, or the brand name of a standalone render. */
    readonly title: string
    /** The MP4 path in the videos bucket. */
    readonly outputPath: string
    /** The video duration in milliseconds, when recorded. */
    readonly durationMs: number | null
    /** When the render was queued. */
    readonly createdAt: string
}
