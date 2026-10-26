import { eventStreamUrl } from "@/modules/config"
import { LocalStorage, StorageId } from "@/modules/storage"
import { followEventStream } from "../clients/read-event-stream"
import type { StreamReporter } from "../clients/read-event-stream"

/** What changed in the Office: a new line, a receipt (delivered or seen), or an unread count. */
export type OfficeActivityKind = "message" | "receipt" | "unread"

/** One small notification the office-activity stream pushes (be/src/features/realtime/office-activity): it names what changed, never the content. */
export interface OfficeActivityPush {
    readonly id: string
    readonly kind: OfficeActivityKind
    /** The Hub room key or the conversation the change belongs to; null for the Office room. */
    readonly roomOrConversation: string | null
    readonly at: string
}

/** What following the office-activity stream takes. */
interface StreamOfficeActivityParams {
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: read the snapshot once, which closes the gap since the last frame. */
    readonly onOpen: () => void
    /** Called for each notification for the signed-in reader. */
    readonly onPush: (push: OfficeActivityPush) => void
    /** Where a refused or broken attempt is reported. */
    readonly report?: StreamReporter
}

/** True when a parsed JSON value is a notification of the stream. */
const isPush = (value: unknown): value is OfficeActivityPush =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "kind" in value &&
    (value.kind === "message" || value.kind === "receipt" || value.kind === "unread") &&
    "roomOrConversation" in value &&
    (value.roomOrConversation === null || typeof value.roomOrConversation === "string") &&
    "at" in value &&
    typeof value.at === "string"

/** The parsed JSON of an event, or undefined when its data is not JSON. */
const parsed = (data: string): unknown => {
    try {
        return JSON.parse(data)
    } catch {
        return undefined
    }
}

/** Follows the office-activity event stream of the signed-in reader (`GET /realtime/office-activity`) in the active workspace until the signal aborts. */
export const streamOfficeActivity = ({ signal, onOpen, onPush, report }: StreamOfficeActivityParams): Promise<void> => {
    const workspaceId = LocalStorage.get<string>(StorageId.ActiveWorkspaceId)
    return followEventStream({
        url: eventStreamUrl("/realtime/office-activity"),
        headers: workspaceId === undefined ? {} : { "X-Workspace-Id": workspaceId },
        signal,
        onOpen,
        onEvent: (event) => {
            const push = parsed(event.data)
            if (isPush(push)) onPush(push)
        },
        ...(report === undefined ? {} : { report }),
    })
}
