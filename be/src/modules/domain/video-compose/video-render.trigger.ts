import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import type { OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"
import { RENDER_COMPLETED } from "./video-render-data.policy"
import { RENDER_COMPLETED_DATA, RENDER_ROW } from "./video-render.trigger.schema"

/*
 * THE COMPOSE PROVIDERS' RENDER TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): a render NIVO asked a compose
 * provider for ended, done or failed, as ONE canonical event. Its raw is the `<provider>.render` row the render door's intake kept (each
 * provider's pure `completionOf` mapped the webhook body; only a sound terminal completion is a row, so a repeat or a progress ping never
 * reaches the trigger). Pure: the translate reads only its argument. The run that started the render waits for it by `data.renderId`.
 */

/** The data of one finished render: the facts of its row. */
export type RenderCompletedData = {
    /** The provider's id of the render: what a waiting run matches (the key). */
    readonly renderId: string
    /** `done` or `failed`. */
    readonly status: "done" | "failed"
    /** The https address of the finished video, for `done`. */
    readonly outputUrl?: string | undefined
    /** The provider's words, for `failed`. */
    readonly error?: string | undefined
    /** The compose provider that rendered it. */
    readonly provider: string
}

/** The `<provider>.render` row value (video-render-data.policy.ts `RenderRow`, its absent members as JSON reads them). The translate's raw. */
export interface RenderRowValue {
    /** The provider's id of the render. */
    readonly renderId: string
    /** `done` or `failed`, as the stored row has it. */
    readonly status: string
    /** The https address of the finished video, when the row has one. */
    readonly outputUrl?: string | undefined
    /** The provider's words, when the render failed. */
    readonly error?: string | undefined
    /** The compose provider that rendered it. */
    readonly provider: string
}

/** The translate: the completion of one stored render row; null for a status that is no terminal one. */
export const translateRenderRow = (row: RenderRowValue): OptionalCanonicalEvent<RenderCompletedData> => {
    if (row.renderId === "" || (row.status !== "done" && row.status !== "failed")) return null
    return {
        id: row.renderId,
        data: {
            renderId: row.renderId,
            status: row.status,
            ...(row.outputUrl === undefined ? {} : { outputUrl: row.outputUrl }),
            ...(row.error === undefined ? {} : { error: row.error }),
            provider: row.provider,
        },
    }
}

/** The declaration of each compose provider, made once: the engine's registry and the delivery compare the object itself. */
const DECLARED = new Map<string, TriggerDeclaration<RenderRowValue, RenderCompletedData>>()

/**
 * One compose provider's render trigger: received by its webhook through the render door, keyed by the render. The same object for the
 * same provider every time (the render door is generic: a compose provider is whatever registered its port in the compose registry).
 */
export const renderTriggerOf = (provider: string): TriggerDeclaration<RenderRowValue, RenderCompletedData> => {
    const held = DECLARED.get(provider)
    if (held !== undefined) return held
    const declared: TriggerDeclaration<RenderRowValue, RenderCompletedData> = {
        provider,
        name: RENDER_COMPLETED,
        verb: TRIGGER.videoRenderCompleted,
        via: "webhook",
        raw: RENDER_ROW,
        data: RENDER_COMPLETED_DATA,
        translate: translateRenderRow,
        key: { by: "data", member: "renderId" },
        settle: null,
    }
    DECLARED.set(provider, declared)
    return declared
}
