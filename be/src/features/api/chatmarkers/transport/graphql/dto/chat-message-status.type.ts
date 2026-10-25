import { registerEnumType } from "@nestjs/graphql"

/** Ordered persisted-message states; pending sending remains client-local. */
export const ChatMessageStatus = { sent: "sent", delivered: "delivered", seen: "seen" }

registerEnumType(ChatMessageStatus, { name: "ChatMessageStatus" })
