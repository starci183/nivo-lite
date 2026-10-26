import type { RealtimeTopic } from "@modules/platform/realtime"
import type { ChatActivityFrame, ChatActivityTarget } from "./chat-activity.contracts"

/** The frame name of a room or conversation; the general Office is `room:office`, as the typing channel names it. */
export const chatActivityTarget = (target: ChatActivityTarget): string =>
    target.conversationId === null
        ? `room:${target.room ?? "office"}`
        : `conversation:${target.conversationId.toLowerCase()}`

const isChatActivityFrame = (value: unknown): value is ChatActivityFrame =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "kind" in value &&
    (value.kind === "message" || value.kind === "receipt" || value.kind === "unread") &&
    "roomOrConversation" in value &&
    typeof value.roomOrConversation === "string" &&
    "at" in value &&
    typeof value.at === "string"

/**
 * The chat notification channel of one member in one workspace. The recipient is part of the name, so a stream built from another
 * principal can never receive these frames: the publisher pushes one copy per active member, the SSE door subscribes only the
 * caller's own copy. One stream carries every room and conversation, because a member sees all of them in one screen.
 */
export const chatActivityTopic = (recipientId: string, workspaceId: string): RealtimeTopic<ChatActivityFrame> => ({
    name: `chat-activity:${recipientId}:${workspaceId.toLowerCase()}`,
    accepts: isChatActivityFrame,
})
