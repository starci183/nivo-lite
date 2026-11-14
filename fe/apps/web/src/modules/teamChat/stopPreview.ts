import type { ReactNode } from "react"
import { agentMessagePreviewSchema, packageKindRefusalOf, type AgentMessageKind, type AgentMessagePreview } from "@nivo-lite/agent-sdk/team-chat"
import { agentMessageViews } from "@/modules/plugin-registry/client"
import type { TeamChatMessagesCopy } from "@/modules/types"
import { agentMessageWordsOf } from "./agentWords"
import type { StopPreviewTarget } from "./stopCard"

/** What a registered view is given besides its payload (the view's own context type, read from the registry). */
type PreviewContext = Parameters<(typeof agentMessageViews)[number]["preview"]>[1]

/**
 * The view that draws the preview of a stop, with the payload as its kind parsed it: the same rule the approval card follows in
 * blocks-core (`previewViewOf`). Nothing (the stop is drawn without a preview) when no preview came, no view is registered for the kind,
 * the kind is a core one or declares a verdict, or the payload fails the kind's schema.
 */
export const stopPreviewViewOf = <View extends { readonly kind: AgentMessageKind }>(
    preview: AgentMessagePreview | null,
    views: ReadonlyArray<View>,
): { readonly view: View; readonly payload: unknown } | null => {
    if (preview === null) return null
    const view = views.find((entry) => entry.kind.id === preview.kind)
    if (view === undefined || packageKindRefusalOf(view.kind) !== null) return null
    const parsed = view.kind.payload.safeParse(preview.payload)
    return parsed.success ? { view, payload: parsed.data } : null
}

/**
 * The preview a package gave a stop, drawn by the view registered for its kind (the same registry as the approval card's preview).
 * Nothing when there is no preview, the kind is not registered (or is a core kind), or the payload does not fit the kind: the card
 * works without it.
 */
export const stopPreviewNodeOf = (
    preview: AgentMessagePreview | null,
    stop: StopPreviewTarget,
    copy: TeamChatMessagesCopy,
): ReactNode => {
    const found = stopPreviewViewOf(preview, agentMessageViews)
    if (found === null) return null
    const context: PreviewContext = {
        record: {
            id: stop.id,
            kind: "workflow.stopped",
            intent: "report",
            agent: "",
            to: "",
            at: "",
            level: "",
            title: stop.title,
            summary: "",
            payload: {},
            options: [],
            why: [],
            detailHref: "",
            note: "",
        },
        words: agentMessageWordsOf(copy),
        views: agentMessageViews,
    }
    return found.view.preview(found.payload, context)
}

/** The preview a stop carries as the door answers it: the kind, and the payload as JSON text. */
interface StopPreviewWire {
    readonly kind: string
    readonly payloadJson: string
}

/** The preview of a stop, read from the door's JSON text; null when the stop carries none or the text is not a preview. */
export const stopPreviewOf = (preview: StopPreviewWire | null | undefined): AgentMessagePreview | null => {
    if (preview == null) return null
    try {
        const payload: unknown = JSON.parse(preview.payloadJson)
        return agentMessagePreviewSchema.safeParse({ kind: preview.kind, payload }).data ?? null
    } catch {
        return null
    }
}
