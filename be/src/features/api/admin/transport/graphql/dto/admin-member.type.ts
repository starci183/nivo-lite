import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One member of the workspace. */
export class AdminMemberType {
    /** The user id. */
    @Field(() => ID)
    userId!: string

    /** The role. */
    @Field()
    role!: string

    /** The display name. */
    @Field()
    displayName!: string

    /** The status. */
    @Field()
    status!: string

    /** The email. */
    @Field(() => String, { nullable: true })
    email!: string | null
}
