import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One captured application error of a workspace. */
export class AdminErrorType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The scope. */
    @Field()
    scope!: string

    /** The message. */
    @Field()
    message!: string

    /** The created at. */
    @Field()
    createdAt!: string
}
