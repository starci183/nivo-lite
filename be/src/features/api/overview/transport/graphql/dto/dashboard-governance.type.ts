import { Field, Int, ObjectType } from "@nestjs/graphql"
import { DashboardAuthorityType } from "./dashboard-authority.type"
import { DashboardDecisionType } from "./dashboard-decision.type"
import { DashboardGovernanceDecisionType } from "./dashboard-governance-decision.type"
import { DashboardGovernanceInvoiceType } from "./dashboard-governance-invoice.type"
import { DashboardGovernanceLeadType } from "./dashboard-governance-lead.type"
import { DashboardGovernanceOrderType } from "./dashboard-governance-order.type"
import { DashboardGovernanceTransactionType } from "./dashboard-governance-transaction.type"
import { DashboardGovernanceWorkType } from "./dashboard-governance-work.type"

@ObjectType()
/** The rows behind the governance figures. */
export class DashboardGovernanceType {
    /** The owner goals, or null when none are set. */
    @Field(() => DashboardAuthorityType, { nullable: true })
    authority!: DashboardAuthorityType | null

    /** The leads. */
    @Field(() => [DashboardGovernanceLeadType])
    leads!: Array<DashboardGovernanceLeadType>

    /** The confirmed, invoiced or paid orders. */
    @Field(() => [DashboardGovernanceOrderType])
    orders!: Array<DashboardGovernanceOrderType>

    /** The issued or paid invoices. */
    @Field(() => [DashboardGovernanceInvoiceType])
    invoices!: Array<DashboardGovernanceInvoiceType>

    /** The matched, unmatched or review payments. */
    @Field(() => [DashboardGovernanceTransactionType])
    transactions!: Array<DashboardGovernanceTransactionType>

    /** The newest work items. */
    @Field(() => [DashboardGovernanceWorkType])
    work!: Array<DashboardGovernanceWorkType>

    /** Pending approvals with no work item. */
    @Field(() => Int)
    pendingWithoutWork!: number

    /** The decisions of the last 7 days. */
    @Field(() => [DashboardGovernanceDecisionType])
    decisions7!: Array<DashboardGovernanceDecisionType>

    /** The latest decisions of the history. */
    @Field(() => [DashboardDecisionType])
    recent!: Array<DashboardDecisionType>
}
