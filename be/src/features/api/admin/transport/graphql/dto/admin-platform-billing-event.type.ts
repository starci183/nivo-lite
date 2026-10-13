import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One billing event of the platform. */
export class AdminPlatformBillingEventType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The workspace id. */
    @Field(() => ID, { nullable: true })
    workspaceId!: string | null

    /** The kind. */
    @Field()
    kind!: string

    /** The created at. */
    @Field()
    createdAt!: string
}
