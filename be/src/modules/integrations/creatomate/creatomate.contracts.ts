/**
 * The members of the Creatomate renders API NIVO sends and reads (https://creatomate.com/llms/api.md,
 * https://creatomate.com/llms/quick-start.md, https://creatomate.com/docs/api/reference/what-is-a-render).
 */

/**
 * The status words of a render: "planned | waiting | transcribing | rendering | succeeded | failed" (quick-start, "Polling"); meanings:
 * planned = queued, waiting = waiting for a third-party integration, transcribing = generating subtitles, rendering = being generated
 * (what-is-a-render, "Render statuses").
 */
export const CREATOMATE_STATUSES = ["planned", "waiting", "transcribing", "rendering", "succeeded", "failed"] as const

/** One Creatomate render status. */
export type CreatomateStatus = (typeof CREATOMATE_STATUSES)[number]

/** How long Creatomate hosts a render and its file: "up to 30 days, then permanently deleted" (what-is-a-render, "File URL"). */
export const CREATOMATE_RETENTION_MS: number = 30 * 24 * 3_600_000

/** The most bytes of a request body: "Request bodies are capped at 2 MB" (https://creatomate.com/llms/api.md, "Errors"). */
export const CREATOMATE_BODY_MAX_BYTES = 2_000_000

/** A JSON value of the RenderScript. */
export type CreatomateJson = string | number | boolean | null | ReadonlyArray<CreatomateJson> | { readonly [key: string]: CreatomateJson }

/** One element of a RenderScript: `type` and the properties the mapping sets. */
export interface CreatomateElement {
    /** The kind of element: what it renders in the video. */
    readonly type: "video" | "audio" | "image" | "text"
    readonly [property: string]: CreatomateJson
}

/** A RenderScript posted at the top level of `POST /v2/renders` (no `template_id`): output settings and `elements`. */
export interface CreatomateSource {
    /** The container of the output file. */
    readonly output_format: "mp4"
    /** The output width in pixels. */
    readonly width: number
    /** The output height in pixels. */
    readonly height: number
    /** The output frames per second. */
    readonly frame_rate: number
    /** The elements of the video, in the order they are composed. */
    readonly elements: ReadonlyArray<CreatomateElement>
}

/** What one render start sends: the RenderScript and, when NIVO has a public origin, `webhook_url`. */
export interface CreatomateRenderRequest {
    /** The RenderScript. */
    readonly source: CreatomateSource
    /** `webhook_url`: called when the render succeeds or fails; null = none. */
    readonly webhookUrl: string | null
}

/** A render as the API answers it (the members NIVO reads). */
export interface CreatomateRender {
    /** `id`. */
    readonly id: string
    /** `status`. */
    readonly status: CreatomateStatus
    /** `url`: the output file, usable once `succeeded`; null when absent. */
    readonly url: string | null
    /** `error_message`, once `failed`; null when absent. */
    readonly errorMessage: string | null
}
