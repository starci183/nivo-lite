import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One metric and the change against the week before. */
export class ReportMetricType {
    /** This week. */
    @Field(() => Int)
    value!: number

    /** The week before. */
    @Field(() => Int)
    previous!: number

    /** Change in percent; null when the week before was zero. */
    @Field(() => Int, { nullable: true })
    changePct!: number | null
}

@ObjectType()
/** The engagements of one channel on one day. */
export class ChannelValueType {
    /** The channel. */
    @Field()
    channel!: string

    /** The engagements. */
    @Field(() => Int)
    value!: number
}

@ObjectType()
/** One day of the report chart. */
export class ReportDayType {
    /** The day, `YYYY-MM-DD`. */
    @Field()
    day!: string

    /** Engagements by channel. */
    @Field(() => [ChannelValueType])
    channels!: ReadonlyArray<ChannelValueType>
}

@ObjectType()
/** The weekly marketing report. */
export class WeeklyReportType {
    /** Monday, `YYYY-MM-DD`. */
    @Field()
    weekStart!: string

    /** Sunday, `YYYY-MM-DD`. */
    @Field()
    weekEnd!: string

    /** Reach. */
    @Field(() => ReportMetricType)
    reach!: ReportMetricType

    /** Engagements. */
    @Field(() => ReportMetricType)
    engagements!: ReportMetricType

    /** New messages. */
    @Field(() => ReportMetricType)
    messages!: ReportMetricType

    /** The days, Monday first. */
    @Field(() => [ReportDayType])
    days!: ReadonlyArray<ReportDayType>

    /** The channels that reported. */
    @Field(() => [String])
    channels!: ReadonlyArray<string>
}
