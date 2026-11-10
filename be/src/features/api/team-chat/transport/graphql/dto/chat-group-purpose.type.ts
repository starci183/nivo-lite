import { registerEnumType } from "@nestjs/graphql"

/** What a group may be given as its purpose: plain, the common room, or the room of one module's team. */
export const ChatGroupPurpose = { group: "group", common: "common", module: "module" }

registerEnumType(ChatGroupPurpose, { name: "ChatGroupPurpose" })
