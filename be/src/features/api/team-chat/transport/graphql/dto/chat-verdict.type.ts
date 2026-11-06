import { registerEnumType } from "@nestjs/graphql"

/** What a person answers an approval card. */
export const ChatVerdict = { approve: "approve", reject: "reject" }

registerEnumType(ChatVerdict, { name: "ChatVerdict" })
