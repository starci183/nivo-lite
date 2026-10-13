import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One approval card with the context the Office shows around it. */
export class OfficeApprovalType {
    /** The card id. */
    @Field(() => ID)
    id!: string

    /** The responsibility it belongs to. */
    @Field(() => ID)
    responsibility_id!: string

    /** The agent that drafted it. */
    @Field(() => ID, { nullable: true })
    agent_id?: string | null

    /** The kind of card. */
    @Field()
    kind!: string

    /** The draft to approve. */
    @Field()
    draft!: string

    /** `pending_approval`, `approved` or `rejected`. */
    @Field()
    status!: string

    /** Who decided. */
    @Field(() => String, { nullable: true })
    decided_by?: string | null

    /** When it was decided, ISO 8601. */
    @Field(() => String, { nullable: true })
    decided_at?: string | null

    /** When it was created, ISO 8601. */
    @Field()
    created_at!: string

    /** The work item behind it. */
    @Field(() => ID, { nullable: true })
    work_item_id?: string | null

    /** The customer name. */
    @Field(() => String, { nullable: true })
    leadName?: string | null

    /** The customer id. */
    @Field(() => ID, { nullable: true })
    leadId?: string | null

    /** The channel the customer talks on. */
    @Field()
    channel!: string

    /** The agent name. */
    @Field(() => String, { nullable: true })
    agentName?: string | null

    /** What happens next. */
    @Field()
    nextAction!: string

    /** The staff member the work is assigned to. */
    @Field(() => ID, { nullable: true })
    assignedStaffId?: string | null
}
