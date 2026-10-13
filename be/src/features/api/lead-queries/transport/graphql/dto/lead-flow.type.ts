import { Field, ObjectType } from "@nestjs/graphql"
import { LeadFlowDecisionType } from "./lead-flow-decision.type"
import { LeadFlowInvoiceType } from "./lead-flow-invoice.type"
import { LeadFlowOrderType } from "./lead-flow-order.type"
import { LeadFlowTransactionType } from "./lead-flow-transaction.type"
import { LeadFlowWorkItemType } from "./lead-flow-work-item.type"

@ObjectType()
/** The work, commercial records and decisions connected to one lead. */
export class LeadFlowType {
    /** Work items enriched with lead and assignment display details. */
    @Field(() => [LeadFlowWorkItemType])
    workItems!: Array<LeadFlowWorkItemType>

    /** Sales orders connected to the lead. */
    @Field(() => [LeadFlowOrderType])
    orders!: Array<LeadFlowOrderType>

    /** Invoices connected to the lead. */
    @Field(() => [LeadFlowInvoiceType])
    invoices!: Array<LeadFlowInvoiceType>

    /** Payment transactions connected through the lead invoices. */
    @Field(() => [LeadFlowTransactionType])
    transactions!: Array<LeadFlowTransactionType>

    /** Policy and human decisions recorded for the lead. */
    @Field(() => [LeadFlowDecisionType])
    decisions!: Array<LeadFlowDecisionType>
}
