import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One application error of the platform. */
export class AdminPlatformErrorType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The scope. */
    @Field()
    scope!: string

    /** The message. */
    @Field()
    message!: string

    /** The workspace id. */
    @Field(() => ID, { nullable: true })
    workspaceId!: string | null

    /** The created at. */
    @Field()
    createdAt!: string
}
