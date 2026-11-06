import { registerEnumType } from "@nestjs/graphql"

/** Who wrote a message. */
export const ChatAuthorKind = { user: "user", agent: "agent", system: "system" }

registerEnumType(ChatAuthorKind, { name: "ChatAuthorKind" })
