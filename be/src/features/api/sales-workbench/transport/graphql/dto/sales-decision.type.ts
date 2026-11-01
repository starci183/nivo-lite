import { Field, ObjectType, ID, Float } from "@nestjs/graphql"

@ObjectType()
/** One proposed Sales action awaiting approval or clarification. */
export class SalesDecisionType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The source. */
    @Field(() => String)
    source!: string

    /** The work item id. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The execution id. */
    @Field(() => ID, { nullable: true })
    executionId!: string | null

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer. */
    @Field(() => String)
    customer!: string

    /** The action. */
    @Field(() => String)
    action!: string

    /** The reason. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The summary. */
    @Field(() => String)
    summary!: string

    /** The draft. */
    @Field(() => String)
    draft!: string

    /** The amount vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The has amount. */
    @Field(() => Boolean)
    hasAmount!: boolean

    /** The missing. */
    @Field(() => [String])
    missing!: ReadonlyArray<string>

    /** The assigned staff id. */
    @Field(() => ID, { nullable: true })
    assignedStaffId!: string | null

    /** The assigned staff name. */
    @Field(() => String, { nullable: true })
    assignedStaffName!: string | null

    /** The created at. */
    @Field(() => String)
    createdAt!: string

    /** The newest conversation of the customer. */
    @Field(() => ID, { nullable: true })
    conversationId!: string | null
}
