import { cutDetail } from "@modules/integrations/provider-http"
import type { Json2VideoMovieState } from "@modules/integrations/json2video"
import { isRecord } from "@modules/platform/primitives"
import type { OptionalRenderCompletion, RenderState } from "@modules/domain/video-compose"

/*
 * JSON2Video's render status and webhook, in NIVO's neutral words. Pure.
 * Status (https://json2video.com/docs/v2/reference/api-endpoints/movies-status): `pending` queued, `running` rendering, `done`
 * (the MP4 is `movie.url`), `error` (the reason is `movie.message`), `timeout` which "the client computes when a movie is running and
 * created_at is more than 15 minutes old... treat it as a fatal error".
 * Webhook (https://json2video.com/docs/v2/reference/webhooks): one POST per render, a flat body; "the payload has no event name, so
 * read `success`": `true` with `url` and `project`, or `false` with `error` and `project`; the dashboard's Test sends `"test": true`.
 */

/** How long a render may run before the client calls it timed out (movies-status). */
export const JSON2VIDEO_TIMEOUT_MS: number = 15 * 60_000

/** The words a timed-out render is failed with. */
export const JSON2VIDEO_TIMEOUT_WORDS = "JSON2Video: the render was still running 15 minutes after it was created, which its docs treat as a failure"

/** The words a `done` render without a video address is failed with (the docs: `url` is null after the file is deleted, files are kept 7 days). */
export const JSON2VIDEO_NO_URL_WORDS = "JSON2Video: the render is done but holds no https video address (it keeps files for 7 days)"

/** An https address, or null for anything else. */
const httpsUrlOf = (value: unknown): string | null => {
    if (typeof value !== "string" || !URL.canParse(value)) return null
    return new URL(value).protocol === "https:" ? value : null
}

/** The render as the status endpoint reports it, at `now`. */
export const renderStateOf = (movie: Json2VideoMovieState, now: Date): RenderState => {
    const renderId = movie.project
    const created = movie.createdAt === null ? Number.NaN : Date.parse(movie.createdAt)
    const stale = movie.status === "running" && Number.isFinite(created) && now.getTime() - created > JSON2VIDEO_TIMEOUT_MS
    if (movie.status === "timeout" || stale) return { renderId, status: "failed", error: JSON2VIDEO_TIMEOUT_WORDS }
    switch (movie.status) {
        case "pending":
            return { renderId, status: "queued" }
        case "running":
            return { renderId, status: "rendering" }
        case "error":
            return { renderId, status: "failed", ...(movie.message === "" ? {} : { error: movie.message }) }
        case "done": {
            const url = httpsUrlOf(movie.url)
            return url === null ? { renderId, status: "failed", error: JSON2VIDEO_NO_URL_WORDS } : { renderId, status: "done", outputUrl: url }
        }
    }
}

/**
 * The neutral completion a webhook body reports: `success: true` with an https `url` is done, `success: false` is failed with the
 * provider's `error`; the render id is `project`. A test ping, a body without a project, a success without an https video address and
 * anything unreadable report no finished render (null).
 */
export const completionOf = (body: unknown): OptionalRenderCompletion => {
    if (!isRecord(body) || body.test === true) return null
    const renderId = typeof body.project === "string" && body.project.trim() !== "" ? body.project.trim() : null
    if (renderId === null) return null
    if (body.success === true) {
        const url = httpsUrlOf(body.url)
        return url === null ? null : { renderId, status: "done", outputUrl: url }
    }
    if (body.success === false) {
        const error = cutDetail(body.error)
        return { renderId, status: "failed", ...(error === null ? {} : { error }) }
    }
    return null
}
