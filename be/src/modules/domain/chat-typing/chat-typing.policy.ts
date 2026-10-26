import type { ChatTarget } from "@modules/domain/chat-markers"
import type { RealtimeTopic } from "@modules/platform/realtime"
import type { ChatTypingFrame } from "./chat-typing.contracts"

/** True when a value is a push of the chat-typing channel. */
export const isChatTypingFrame = (value: unknown): value is ChatTypingFrame =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "actorId" in value &&
    typeof value.actorId === "string" &&
    "actorName" in value &&
    typeof value.actorName === "string" &&
    "state" in value &&
    (value.state === "start" || value.state === "stop") &&
    "at" in value &&
    typeof value.at === "string"

/**
 * The channel of the typing frames one recipient may see in one workspace target. The recipient is part of the name, so a stream
 * built from another principal can never receive these frames: the publisher pushes one copy per admitted member, the SSE door
 * subscribes only the caller's own copy.
 */
export const chatTypingTopic = (
    recipientId: string,
    workspaceId: string,
    target: ChatTarget,
): RealtimeTopic<ChatTypingFrame> => ({
    name:
        target.conversationId === null
            ? `chat-typing:${recipientId}:${workspaceId.toLowerCase()}:room:${target.room ?? "office"}`
            : `chat-typing:${recipientId}:${workspaceId.toLowerCase()}:conversation:${target.conversationId.toLowerCase()}`,
    accepts: isChatTypingFrame,
})
