import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One active member who read the caller's last authored message. */
export class ChatSeenMemberType {
    /** The member's account id. */
    @Field(() => ID)
    id!: string

    /** The current workspace display name. */
    @Field(() => String)
    name!: string

    /** Stable input for the existing initials avatar provider. */
    @Field(() => String)
    avatarSeed!: string

    /** The profile picture; null keeps the generated initials avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl!: string | null
}
