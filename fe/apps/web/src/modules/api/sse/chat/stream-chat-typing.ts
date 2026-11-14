import { eventStreamUrl } from "@/modules/config"
import { openWorkspaceId } from "@/modules/routes"
import type { EventStreamHandle } from "@starci/event-stream"
import { eventStream, type StreamReporter } from "../clients/event-stream"

/** One typing hint the stream pushes (be/src/features/realtime/chat-typing): who, and until when. */
export interface ChatTypingPush {
    readonly id: string
    readonly name: string
    readonly avatarSeed: string
    /** False clears the hint at once; true holds only until `expiresAt`. */
    readonly typing: boolean
    /** ISO 8601 time the hint lapses, including when the stop signal was lost. */
    readonly expiresAt: string
}

/** One event of the stream as the follower hands it over: the frame, or null when the event was not one. */
interface ChatTypingFrame {
    readonly data: ChatTypingPush | null
}

/** What following the typing stream of one room takes. */
interface StreamChatTypingParams {
    /** The team-chat room the hints belong to. */
    readonly roomId: string
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: read the stored state once, which closes the gap since the last frame. */
    readonly onOpen: () => void
    /** Called for each hint. */
    readonly onPush: (push: ChatTypingPush) => void
    /** Called when an attempt failed and the stream will try again. */
    readonly onDrop?: () => void
    /** Where a refused or broken attempt is reported. */
    readonly report?: StreamReporter
}

/** True when a parsed JSON value is a typing frame of the stream. */
const isPush = (value: unknown): value is ChatTypingPush =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "avatarSeed" in value &&
    typeof value.avatarSeed === "string" &&
    "typing" in value &&
    typeof value.typing === "boolean" &&
    "expiresAt" in value &&
    typeof value.expiresAt === "string"

/** The typing frame of one event, or null when its data is not JSON or not a frame (the event is then ignored). */
const pushOf = (data: string): ChatTypingPush | null => {
    try {
        const push: unknown = JSON.parse(data)
        return isPush(push) ? push : null
    } catch {
        return null
    }
}

/** Follows the typing event stream of one room for the signed-in member (`GET /realtime/chat-typing?roomId=`) until the signal aborts. */
export const streamChatTyping = ({
    roomId,
    signal,
    onOpen,
    onPush,
    onDrop,
    report,
}: StreamChatTypingParams): EventStreamHandle => {
    const workspaceId = openWorkspaceId()
    const headers: Record<string, string> = {}
    if (workspaceId !== undefined) headers["x-workspace-id"] = workspaceId
    const handlers = {
        signal,
        headers,
        parse: pushOf,
        onOpen,
        onFrame: ({ data }: ChatTypingFrame) => (data === null ? undefined : onPush(data)),
        onError: (error: Error) => {
            onDrop?.()
            report?.(`[event stream] ${error.message}`)
        },
    }
    return eventStream.follow<ChatTypingPush | null>(
        eventStreamUrl(`/realtime/chat-typing?roomId=${encodeURIComponent(roomId)}`),
        handlers,
    )
}
