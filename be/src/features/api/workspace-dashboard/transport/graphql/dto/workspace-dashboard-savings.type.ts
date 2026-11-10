import { Field, Float, Int, ObjectType } from "@nestjs/graphql"
import { WorkspaceDashboardSavingLineType } from "./workspace-dashboard-saving-line.type"

@ObjectType()
/** What the agents did for the owner in the period, and the table that turns it into hours. */
export class WorkspaceDashboardSavingsType {
    /** Minutes saved: each finished action times the minutes the table gives it. */
    @Field(() => Float)
    minutesSaved!: number

    /** The largest lines of that sum, for the definition shown on hover. */
    @Field(() => [WorkspaceDashboardSavingLineType])
    lines!: Array<WorkspaceDashboardSavingLineType>

    /** Minutes an action that is not in the table is worth. */
    @Field(() => Int)
    defaultMinutes!: number

    /** Replies an agent posted to customers. */
    @Field(() => Int)
    messagesAnswered!: number

    /** Orders placed. */
    @Field(() => Int)
    ordersCreated!: number

    /** Matched payments. */
    @Field(() => Int)
    paymentsMatched!: number

    /** Credits used this month. */
    @Field(() => Int)
    creditsUsed!: number

    /** The credits of the month with the carry-over; null is unlimited. */
    @Field(() => Int, { nullable: true })
    creditsLimit!: number | null
}
