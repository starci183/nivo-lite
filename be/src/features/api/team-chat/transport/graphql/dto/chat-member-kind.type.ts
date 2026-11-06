import { registerEnumType } from "@nestjs/graphql"

/** Whether a member is a person or an agent. */
export const ChatMemberKind = { user: "user", agent: "agent" }

registerEnumType(ChatMemberKind, { name: "ChatMemberKind" })
