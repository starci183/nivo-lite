import { Field, ObjectType } from "@nestjs/graphql"
import { MemberType } from "./member.type"

@ObjectType()
/** A member as the team page lists them. */
export class MemberListingType extends MemberType {
    /** The profile picture; null keeps the generated initials avatar. */
    @Field(() => String, { nullable: true })
    avatarUrl!: string | null

    /** The account email; blank for staff viewers. */
    @Field()
    email!: string

    /** The last sign-in, ISO 8601; null when unknown. */
    @Field(() => String, { nullable: true })
    lastSignInAt!: string | null
}
