import { Field, ID, ObjectType } from "@nestjs/graphql"
import { DashboardResponsibilityLeadType } from "./dashboard-responsibility-lead.type"

@ObjectType()
/** One responsibility with its lead. */
export class DashboardResponsibilityType {
    /** The responsibility id. */
    @Field(() => ID)
    id!: string

    /** The lead it is about. */
    @Field(() => ID)
    leadId!: string

    /** What it is. */
    @Field()
    title!: string

    /** `human` or `agent`. */
    @Field()
    ownerKind!: string

    /** The owning agent, when an agent owns it. */
    @Field(() => ID, { nullable: true })
    ownerAgentId!: string | null

    /** The owner name. */
    @Field()
    ownerName!: string

    /** The next action. */
    @Field()
    nextAction!: string

    /** When it is due, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** `open`, `waiting_approval` or `done`. */
    @Field()
    status!: string

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** The lead behind it. */
    @Field(() => DashboardResponsibilityLeadType)
    lead!: DashboardResponsibilityLeadType
}
