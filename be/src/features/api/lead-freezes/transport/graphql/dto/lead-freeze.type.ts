import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A customer who waits for the owner to handle a failed run: no new run starts for them until the owner answers. */
export class LeadFreezeType {
    /** The freeze. */
    @Field(() => ID)
    id!: string

    /** `frozen`, or `retrying` while the owner's retry runs. */
    @Field(() => String)
    status!: string

    /** The workflow whose run stopped, the only one the freeze holds; null for a freeze that holds the customer as a whole. */
    @Field(() => ID, { nullable: true })
    workflowId!: string | null

    /** The lead, or null for a customer who is not a lead yet. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The run that failed. */
    @Field(() => ID, { nullable: true })
    runId!: string | null

    /** The title of the failed step, in the owner's language. */
    @Field(() => String, { nullable: true })
    stepTitle!: string | null

    /** The error code. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The owner's item. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** How many events wait to be replayed. */
    @Field(() => Int)
    pendingCount!: number

    /** The person who took the conversation over, or null. */
    @Field(() => String, { nullable: true })
    heldBy!: string | null
}
