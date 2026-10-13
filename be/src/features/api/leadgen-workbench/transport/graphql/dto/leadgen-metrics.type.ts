import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The figures derived from prospect and conversation records. */
export class LeadGenMetricsType {
    /** The leads created today in Vietnam time. */
    @Field(() => Int)
    newToday!: number
    /** Hot open leads Sales has not classified. */
    @Field(() => Int)
    hotWaiting!: number
    /** Median first reply delay in minutes over thirty days. */
    @Field(() => Float, { nullable: true })
    firstReplyP50Min!: number | null
    /** The number of conversations in the reply sample. */
    @Field(() => Int)
    firstReplySample!: number
    /** The conversion window duration. */
    @Field(() => Int)
    conversionWindowDays!: number
    /** Prospects created within the conversion window. */
    @Field(() => Int)
    conversionLeads!: number
    /** Prospects created in the window that reached won. */
    @Field(() => Int)
    conversionWon!: number
}
