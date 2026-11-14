import type { OptionalRenderCompletion, RenderState, RenderStatus } from "@modules/domain/video-compose"
import { creatomateRenderOf, type CreatomateRender, type CreatomateStatus } from "@modules/integrations/creatomate"

/*
 * Creatomate's render statuses (https://creatomate.com/docs/api/reference/what-is-a-render, "Render statuses") in NIVO's words, and the
 * webhook body (https://creatomate.com/docs/api/reference/set-up-a-webhook: it follows the render object). Pure.
 */

/** planned and waiting (for a third-party integration) are queued; transcribing and rendering are rendering. */
const STATUS_OF: Readonly<Record<CreatomateStatus, RenderStatus>> = {
    planned: "queued",
    waiting: "queued",
    transcribing: "rendering",
    rendering: "rendering",
    succeeded: "done",
    failed: "failed",
}

/** The neutral status of a Creatomate status word. */
export const creatomateStatusOf = (status: CreatomateStatus): RenderStatus => STATUS_OF[status]

/** True for an https address (the only output NIVO keeps). */
const isHttps = (value: string): boolean => {
    return URL.canParse(value) && new URL(value).protocol === "https:"
}

/**
 * A render as `statusOf` reports it. `succeeded` without an https `url` is not yet `done` (the docs: the url "links to the file only
 * after" success), so it reads as `rendering` and the next poll decides.
 */
export const creatomateStateOf = (render: CreatomateRender): RenderState => {
    const status = creatomateStatusOf(render.status)
    if (status === "done") {
        return render.url !== null && isHttps(render.url)
            ? { renderId: render.id, status: "done", outputUrl: render.url }
            : { renderId: render.id, status: "rendering" }
    }
    if (status === "failed") {
        return { renderId: render.id, status: "failed", ...(render.errorMessage === null ? {} : { error: render.errorMessage }) }
    }
    return { renderId: render.id, status }
}

/**
 * The completion a webhook body reports: `succeeded` with an https `url` is done, `failed` carries `error_message`; every other body (a
 * non-terminal status, no id, no url, garbage) reports no finished render.
 */
export const creatomateCompletionOf = (body: unknown): OptionalRenderCompletion => {
    const render = creatomateRenderOf(body)
    if (render === null) return null
    if (render.status === "succeeded") {
        return render.url !== null && isHttps(render.url) ? { renderId: render.id, status: "done", outputUrl: render.url } : null
    }
    if (render.status === "failed") {
        return { renderId: render.id, status: "failed", ...(render.errorMessage === null ? {} : { error: render.errorMessage }) }
    }
    return null
}
