import type { RealtimeTopic } from "@modules/platform/realtime"
import type { ChatActivityFrame } from "./chat-activity.contracts"

const isChatActivityFrame = (value: unknown): value is ChatActivityFrame =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "kind" in value &&
    (value.kind === "message" || value.kind === "receipt" || value.kind === "unread") &&
    "roomId" in value &&
    typeof value.roomId === "string" &&
    "at" in value &&
    typeof value.at === "string"

/**
 * The chat notification channel of one member in one workspace. The recipient is part of the name, so a stream built from another
 * principal can never receive these frames: the publisher pushes one copy per active member, the SSE door subscribes only the
 * caller's own copy. One stream carries every room, because a member sees all of them in one screen.
 */
export const chatActivityTopic = (recipientId: string, workspaceId: string): RealtimeTopic<ChatActivityFrame> => ({
    name: `chat-activity:${recipientId}:${workspaceId.toLowerCase()}`,
    accepts: isChatActivityFrame,
})
