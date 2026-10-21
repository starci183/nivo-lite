import { Field, ID, ObjectType } from "@nestjs/graphql"
import { DashboardExceptionLeadType } from "./dashboard-exception-lead.type"

@ObjectType()
/** A work item waiting for a decision or failed. */
export class DashboardExceptionType {
    /** The work item id. */
    @Field(() => ID)
    id!: string

    /** The lead, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The department. */
    @Field()
    department!: string

    /** The flow action. */
    @Field()
    action!: string

    /** `waiting_decision` or `failed`. */
    @Field()
    status!: string

    /** The reason code, or null. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The failure text, or null. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** The approval card behind it, or null. */
    @Field(() => ID, { nullable: true })
    executionId!: string | null

    /** The assigned staff name, or null. */
    @Field(() => String, { nullable: true })
    assignedStaffName!: string | null

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** The proposal summary, or null. */
    @Field(() => String, { nullable: true })
    summary!: string | null

    /** The proposal contact name, or null. */
    @Field(() => String, { nullable: true })
    contact!: string | null

    /** The proposal customer, or null. */
    @Field(() => String, { nullable: true })
    customer!: string | null

    /** The customer it is about, or null. */
    @Field(() => DashboardExceptionLeadType, { nullable: true })
    lead!: DashboardExceptionLeadType | null
}
