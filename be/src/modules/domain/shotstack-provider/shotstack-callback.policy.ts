import { isRecord } from "@modules/platform/primitives"
import type { OptionalRenderCompletion, OptionalRenderWebhook } from "@modules/domain/video-compose"

/*
 * Shotstack's render webhook (https://shotstack.io/docs/guide/architecting-an-application/webhooks/). It is requested with the Edit's
 * root `callback` URL. The JSON body is `{ type: "edit", action: "render", id, owner, status, url, error, completed }`; the docs name the
 * callback for the two ends only ("finished successfully or failed to complete"), `status` `done` or `failed`, `error` holding the
 * reason on a failure. Shotstack signs nothing ("We do not currently provide signed payloads"), so the only proof is the path token the
 * render door already compared in constant time. Pure.
 */

/** Shotstack's webhook signs nothing: no signature header, no timestamp header. */
export const SHOTSTACK_WEBHOOK: OptionalRenderWebhook = { signatureHeader: null, timestampHeader: null }

/** What a failed render with no reason of its own is reported as. */
const NO_REASON = "Shotstack did not say why the render failed."

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : null

/**
 * The neutral completion a callback body reports: `done` with its https `url`, `failed` with its `error`; `null` for a body that is
 * no render of an edit (another `type` or `action`), a state that is not an end, a `done` without an https address, or anything unreadable.
 */
export const shotstackCompletionOf = (body: unknown): OptionalRenderCompletion => {
    if (!isRecord(body) || body.type !== "edit" || body.action !== "render") return null
    const renderId = textOf(body.id)
    if (renderId === null) return null
    if (body.status === "failed") return { renderId, status: "failed", error: textOf(body.error) ?? NO_REASON }
    if (body.status !== "done") return null
    const url = textOf(body.url)
    return url !== null && URL.canParse(url) && new URL(url).protocol === "https:" ? { renderId, status: "done", outputUrl: url } : null
}
