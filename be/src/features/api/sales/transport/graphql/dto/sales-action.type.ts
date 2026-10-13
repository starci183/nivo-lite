import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A queued Sales action or its current progress. */
export class SalesActionType {
    /** The id the client polls. */
    @Field(() => ID)
    id!: string

    /** Queued, running or a terminal state. */
    @Field()
    status!: string

    /** The resulting work item when it is available. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The stable failure code when the action failed. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
