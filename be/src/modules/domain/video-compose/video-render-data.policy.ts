import { FILE_REMOTE_URL_MAX } from "@nivo-lite/agent-sdk/entity"
import { defineAccountDataType, type AccountDataTypeDef } from "@modules/domain/account-data"
import type { RenderCompletion } from "./video-compose.contracts"
import { RENDER_ID_MAX } from "./video-compose.schema"

/*
 * A finished render as account_data keeps it, and the provider trigger it fires (generic, no business). Every compose provider declares
 * ONE type `<provider>.render` from `renderDataTypeOf`: append-only, keyed by the provider's render id, so a webhook delivered twice
 * writes one row and fires once; only a TERMINAL completion is a row (a progress ping writes nothing). Its new rows wake the generic
 * trigger `nivo.trigger.video.render.completed` through the provider trigger `render.completed`, whose wake carries ids and the closed
 * status only; the run reads `outputUrl`, `error` and `provider` filled from the row (`TriggerSpec.reads`, purpose `video.render`). Pure.
 */

/** The purpose tag of every `<provider>.render` type: what the trigger registry's `reads` names to fill the run from the row. */
export const VIDEO_RENDER_PURPOSE = "video.render"

/** The provider trigger every compose provider declares for a finished render (an adapter detail, never a verb). */
export const RENDER_COMPLETED = "render.completed"

/** The longest provider error a row keeps. */
const ERROR_MAX = 2000

/** The longest provider key. */
const PROVIDER_MAX = 40

/** How long a render row is kept: the output is copied into the record (`nivo.tool.file.put`); the row is evidence, not the file. */
const RETENTION_DAYS = 30

/** The member names no render row may carry, in the spellings the compose providers' APIs use for credentials. */
const RENDER_SECRET_FIELDS: ReadonlyArray<string> = [
    "apiKey",
    "api_key",
    "x-api-key",
    "authorization",
    "token",
    "secret",
    "webhookSecret",
    "webhook_secret",
]

/** The declaration of one compose provider's `<provider>.render` type (the account-data catalogue lists it). */
export const renderDataTypeOf = (provider: string): AccountDataTypeDef =>
    defineAccountDataType({
        name: `${provider}.render`,
        provider,
        version: 1,
        write: "append",
        fields: {
            renderId: { type: "text", required: true, maxLength: RENDER_ID_MAX },
            status: { type: "text", required: true, maxLength: 6 },
            outputUrl: { type: "text", required: false, maxLength: FILE_REMOTE_URL_MAX },
            error: { type: "text", required: false, maxLength: ERROR_MAX },
            provider: { type: "text", required: true, maxLength: PROVIDER_MAX },
        },
        key: ["renderId"],
        wakes: true,
        retention: { days: RETENTION_DAYS },
        indexes: [],
        secretFields: RENDER_SECRET_FIELDS,
        purpose: VIDEO_RENDER_PURPOSE,
    })

/** The type name of a provider's render rows. */
export const renderTypeOf = (provider: string): string => `${provider}.render`

/** The value of one `<provider>.render` row, members exactly as the type declares them. */
export interface RenderRow {
    /** The provider's id of the render: the row key. */
    readonly renderId: string
    /** `done` or `failed`. */
    readonly status: string
    /** The https address of the finished video, for `done`. */
    readonly outputUrl?: string
    /** The provider's words, for `failed`. */
    readonly error?: string
    /** The provider key that rendered it. */
    readonly provider: string
}

/** The value of a render row: the completion as the adapter mapped it, the provider named (an absent member stays absent). */
export const renderRowOf = (provider: string, completion: RenderCompletion): RenderRow => ({
    renderId: completion.renderId,
    status: completion.status,
    ...(completion.outputUrl === undefined ? {} : { outputUrl: completion.outputUrl }),
    ...(completion.error === undefined ? {} : { error: completion.error.slice(0, ERROR_MAX) }),
    provider,
})

/**
 * Whether an adapter's completion may be kept: a render id within its bound, and for `done` an https output address within
 * `FILE_REMOTE_URL_MAX` (`nivo.tool.file.put` takes nothing else). An unsound one is not kept: the run's wait falls back on its timeout.
 */
export const isSoundCompletion = (completion: RenderCompletion): boolean => {
    const id = completion.renderId.trim()
    if (id === "" || id.length > RENDER_ID_MAX) return false
    if (completion.status === "failed") return true
    const url = completion.outputUrl
    return url !== undefined && url.length <= FILE_REMOTE_URL_MAX && URL.canParse(url) && new URL(url).protocol === "https:"
}

/** The payload of one `render.completed` event: the row's id, the render id, the closed status. */
export type RenderCompletedPayload = {
    /** The id of the `<provider>.render` row: what the run's members are filled from. */
    readonly renderRowId: string
    /** The provider's id of the render: what a waiting run matches. */
    readonly renderId: string
    /** `done` or `failed`. */
    readonly status: string
}

/** One event of the provider trigger `render.completed`: keyed by the render id (a repeat is a no-op), ids and the status only. */
export interface RenderCompletedEvent {
    /** The event's id at the provider: the render id (a repeat is a no-op). */
    readonly id: string
    /** When it happened: unknown (the row's write time stands). */
    readonly occurredAt: null
    /** Ids and the closed status only. */
    readonly payload: RenderCompletedPayload
}

/** The event a new render row fires: the row's id (what the run's members are filled from), the render id, the closed status. */
export const renderEventOf = (rowId: string, completion: RenderCompletion): RenderCompletedEvent => ({
    id: completion.renderId,
    occurredAt: null,
    payload: { renderRowId: rowId, renderId: completion.renderId, status: completion.status },
})
