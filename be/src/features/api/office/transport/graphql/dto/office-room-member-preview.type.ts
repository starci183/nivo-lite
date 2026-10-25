import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One member shown in the composite avatar of a Hub room. */
export class OfficeRoomMemberPreviewType {
    /** The member's display name. */
    @Field()
    name!: string

    /** The existing profile picture URL, or null for the name-based avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl?: string | null
}
