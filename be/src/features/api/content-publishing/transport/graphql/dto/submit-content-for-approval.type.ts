import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The gate item a person can approve or reject. */
export class SubmitContentForApprovalType {
    /** The content item. */
    @Field(() => ID)
    id!: string

    /** The existing decisions work item. */
    @Field(() => ID)
    workItemId!: string

    /** Current work status: queued or waiting_decision. */
    @Field()
    status!: string
}
