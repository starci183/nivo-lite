import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The consent of a real person to a persona. */
export class LikenessGrantType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The template key. */
    @Field(() => String)
    templateKey!: string

    /** The person. */
    @Field(() => String)
    personName!: string

    /** What of them the agent may use. */
    @Field(() => [String])
    allowedUses!: Array<string>

    /** The line shown to every customer. */
    @Field(() => String)
    disclosure!: string

    /** True once a reviewer checked the identity. */
    @Field(() => Boolean)
    verified!: boolean

    /** When the consent ends, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    expiresAt!: string | null

    /** True when the person took it back. */
    @Field(() => Boolean)
    revoked!: boolean
}
