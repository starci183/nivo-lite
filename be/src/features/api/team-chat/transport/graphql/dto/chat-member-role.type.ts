import { registerEnumType } from "@nestjs/graphql"

/** What a member may do in a room. */
export const ChatMemberRole = { owner: "owner", member: "member" }

registerEnumType(ChatMemberRole, { name: "ChatMemberRole" })
