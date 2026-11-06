import { registerEnumType } from "@nestjs/graphql"

/** What a message is. */
export const ChatMessageKind = { text: "text", report: "report", approval: "approval", system: "system" }

registerEnumType(ChatMessageKind, { name: "ChatMessageKind" })
