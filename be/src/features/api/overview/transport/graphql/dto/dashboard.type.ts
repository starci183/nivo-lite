import { Field, ObjectType } from "@nestjs/graphql"
import { DashboardAgentType } from "./dashboard-agent.type"
import { DashboardEventType } from "./dashboard-event.type"
import { DashboardExceptionType } from "./dashboard-exception.type"
import { DashboardGovernanceType } from "./dashboard-governance.type"
import { DashboardLeadType } from "./dashboard-lead.type"
import { DashboardPendingType } from "./dashboard-pending.type"
import { DashboardPromoType } from "./dashboard-promo.type"
import { DashboardResponsibilityType } from "./dashboard-responsibility.type"

@ObjectType()
/** Everything the executive dashboard reads. */
export class DashboardType {
    /** The start of the 7-day window the figures were read with, ISO 8601. */
    @Field()
    since7!: string

    /** Every responsibility, due soonest first. */
    @Field(() => [DashboardResponsibilityType])
    responsibilities!: Array<DashboardResponsibilityType>

    /** The agents, oldest first. */
    @Field(() => [DashboardAgentType])
    agents!: Array<DashboardAgentType>

    /** The newest evidence lines, newest first. */
    @Field(() => [DashboardEventType])
    events!: Array<DashboardEventType>

    /** The leads. */
    @Field(() => [DashboardLeadType])
    leads!: Array<DashboardLeadType>

    /** The drafts waiting for a decision, newest first. */
    @Field(() => [DashboardPendingType])
    pending!: Array<DashboardPendingType>

    /** The onboarding facts. */
    @Field(() => DashboardPromoType)
    promo!: DashboardPromoType

    /** The rows behind the governance figures. */
    @Field(() => DashboardGovernanceType)
    governance!: DashboardGovernanceType

    /** The work items waiting for a decision or failed. */
    @Field(() => [DashboardExceptionType])
    exceptions!: Array<DashboardExceptionType>
}
