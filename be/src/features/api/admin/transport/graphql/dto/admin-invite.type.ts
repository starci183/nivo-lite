import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One pending invitation. */
export class AdminInviteType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The email. */
    @Field()
    email!: string

    /** The role. */
    @Field()
    role!: string

    /** The created at. */
    @Field()
    createdAt!: string

    /** The expires at. */
    @Field()
    expiresAt!: string
}
