import { Field, Float, Int, ObjectType } from "@nestjs/graphql"
import { InboxApprovalType } from "./inbox-approval.type"
import { InboxLeadRowType } from "./inbox-lead-row.type"
import { InboxNeedsType } from "./inbox-needs.type"
import { InboxOrderType } from "./inbox-order.type"
import { InboxSourceType } from "./inbox-source.type"
import { InboxTimelineEntryType } from "./inbox-timeline-entry.type"

@ObjectType()
/** One customer opened: the head, what waits, what they need, the journey and the aside. */
export class InboxLeadDetailType {
    /** The row of the customer. */
    @Field(() => InboxLeadRowType)
    lead!: InboxLeadRowType

    /** The phone, or null. */
    @Field(() => String, { nullable: true })
    phone!: string | null

    /** The email, or null. */
    @Field(() => String, { nullable: true })
    email!: string | null

    /** The customer talks to the shop on Zalo too. */
    @Field()
    zaloLinked!: boolean

    /** What waits for the owner, or null. */
    @Field(() => InboxApprovalType, { nullable: true })
    approval!: InboxApprovalType | null

    /** What the customer needs. */
    @Field(() => InboxNeedsType)
    needs!: InboxNeedsType

    /** The journey, oldest first. */
    @Field(() => [InboxTimelineEntryType])
    timeline!: ReadonlyArray<InboxTimelineEntryType>

    /** Where the customer came from. */
    @Field(() => InboxSourceType)
    source!: InboxSourceType

    /** The orders that are more than a draft. */
    @Field(() => [InboxOrderType])
    orders!: ReadonlyArray<InboxOrderType>

    /** What was paid, in VND. */
    @Field(() => Float)
    paidVnd!: number

    /** How many orders were paid. */
    @Field(() => Int)
    paidCount!: number
}
