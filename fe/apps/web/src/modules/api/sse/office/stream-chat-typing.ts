import { eventStreamUrl } from "@/modules/config"
import { LocalStorage, StorageId } from "@/modules/storage"
import { followEventStream } from "../clients/read-event-stream"
import type { StreamReporter } from "../clients/read-event-stream"

/** One typing change the chat-typing stream pushes (be/src/features/realtime/chat-typing): who, whether they started or stopped, and when. */
export interface ChatTypingPush {
    readonly actorId: string
    readonly actorName: string
    readonly state: "start" | "stop"
    readonly at: string
}

/** The chat the stream follows: a Hub room, or a conversation; neither names the Office room. */
export interface ChatTypingTarget {
    readonly room?: string
    readonly conversationId?: string
}

/** What following the chat-typing stream takes. */
interface StreamChatTypingParams {
    /** The chat to follow. */
    readonly target: ChatTypingTarget
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: the moment to clear what the last connection left. */
    readonly onOpen: () => void
    /** Called for each typing change in the chat. */
    readonly onPush: (push: ChatTypingPush) => void
    /** Where a refused or broken attempt is reported. */
    readonly report?: StreamReporter
}

/** True when a parsed JSON value is a push of the stream. */
const isPush = (value: unknown): value is ChatTypingPush =>
    typeof value === "object" &&
    value !== null &&
    "actorId" in value &&
    typeof value.actorId === "string" &&
    "actorName" in value &&
    typeof value.actorName === "string" &&
    "state" in value &&
    (value.state === "start" || value.state === "stop") &&
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

/** The stream path of one chat, with its target as the query. */
const pathOf = ({ room, conversationId }: ChatTypingTarget): string => {
    const query = new URLSearchParams()
    if (room !== undefined) query.set("room", room)
    if (conversationId !== undefined) query.set("conversationId", conversationId)
    const text = query.toString()
    return text === "" ? "/realtime/chat-typing" : `/realtime/chat-typing?${text}`
}

/** Follows the chat-typing event stream of one chat (`GET /realtime/chat-typing`) with the active workspace until the signal aborts. */
export const streamChatTyping = ({ target, signal, onOpen, onPush, report }: StreamChatTypingParams): Promise<void> => {
    const workspaceId = LocalStorage.get<string>(StorageId.ActiveWorkspaceId)
    return followEventStream({
        url: eventStreamUrl(pathOf(target)),
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
