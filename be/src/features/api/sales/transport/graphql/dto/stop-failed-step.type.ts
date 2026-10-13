import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The Sales step after the caller stopped it. */
export class StopFailedStepType {
    /** The stopped work item id. */
    @Field(() => ID)
    id!: string

    /** The work item's current status. */
    @Field()
    status!: string
}
