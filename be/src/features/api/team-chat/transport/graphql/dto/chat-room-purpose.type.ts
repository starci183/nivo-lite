import { registerEnumType } from "@nestjs/graphql"

/** What a room is for: a pair, a plain group, the one room of the whole workspace, or the room of one module's team. */
export const ChatRoomPurpose = { direct: "direct", group: "group", common: "common", module: "module" }

registerEnumType(ChatRoomPurpose, { name: "ChatRoomPurpose" })
