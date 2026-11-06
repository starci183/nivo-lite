import { registerEnumType } from "@nestjs/graphql"

/** Whether a room is a direct room of two or a group. */
export const ChatRoomKind = { direct: "direct", group: "group" }

registerEnumType(ChatRoomKind, { name: "ChatRoomKind" })
