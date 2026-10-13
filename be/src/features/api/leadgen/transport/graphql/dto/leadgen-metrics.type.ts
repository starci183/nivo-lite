import { Field, ObjectType, Int, Float } from "@nestjs/graphql"

@ObjectType()
/** LeadGenMetrics exposed to the workbench. */
export class LeadGenMetricsType {
    /** Prospects captured today in the workspace time zone. */
    @Field(() => Int)
    newToday!: number

    /** Hot prospects waiting for classification. */
    @Field(() => Int)
    hotWaiting!: number

    /** Median first response time in minutes. */
    @Field(() => Float, { nullable: true })
    firstReplyP50Min!: number | null

    /** Conversations behind the response median. */
    @Field(() => Int)
    firstReplySample!: number

    /** Days in the conversion window. */
    @Field(() => Int)
    conversionWindowDays!: number

    /** Prospects in that conversion window. */
    @Field(() => Int)
    conversionLeads!: number

    /** Won prospects in that conversion window. */
    @Field(() => Int)
    conversionWon!: number
}
