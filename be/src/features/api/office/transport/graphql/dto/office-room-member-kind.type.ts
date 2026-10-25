import { registerEnumType } from "@nestjs/graphql"

/** The two identities a room member preview can represent. */
export const OfficeRoomMemberKind = { human: "human", agent: "agent" }

registerEnumType(OfficeRoomMemberKind, { name: "OfficeRoomMemberKind" })
