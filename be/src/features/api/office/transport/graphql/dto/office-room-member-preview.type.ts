import { Field, ObjectType } from "@nestjs/graphql"
import { OfficeRoomMemberKind } from "./office-room-member-kind.type"

@ObjectType()
/** One member shown in the composite avatar of a Hub room. */
export class OfficeRoomMemberPreviewType {
    /** The account id for a person or the agent id. */
    @Field()
    id!: string

    /** Whether this member is a workspace account or an agent. */
    @Field(() => OfficeRoomMemberKind)
    kind!: "human" | "agent"

    /** The agent's module; null for a person. */
    @Field(() => String, { nullable: true })
    module?: string | null

    /** The member's display name. */
    @Field()
    name!: string

    /** The existing profile picture URL, or null for the name-based avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl?: string | null
}
