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
/** One post published in the week with its engagements. */
export class ReportPostType {
    /** The provider post id. */
    @Field()
    id!: string

    /** The channel that published it. */
    @Field()
    channel!: string

    /** The first line of the post text. */
    @Field()
    title!: string

    /** When it was published, ISO 8601. */
    @Field()
    publishedAt!: string

    /** Reactions, comments, shares and clicks. */
    @Field(() => Int)
    engagements!: number

    /** The public https link of the post; null when the channel gave none. */
    @Field(() => String, { nullable: true })
    href!: string | null
}

@ObjectType()
/** One source the suggestion read (layer 1 connectors, layer 2 Second Brain). */
export class ReportSourceType {
    /** The data layer, 1..4. */
    @Field(() => Int)
    layer!: number

    /** The record kind. */
    @Field()
    kind!: string

    /** What was read. */
    @Field()
    ref!: string

    /** The data the reader recognises. */
    @Field()
    label!: string
}

@ObjectType()
/** The model's advice for the next week. */
export class ReportSuggestionType {
    /** The headline. */
    @Field()
    title!: string

    /** The reasoning and the next step. */
    @Field()
    body!: string

    /** The sources the model was given. */
    @Field(() => [ReportSourceType])
    sources!: ReadonlyArray<ReportSourceType>
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

    /** The most engaging posts of the week, at most four. */
    @Field(() => [ReportPostType])
    posts!: ReadonlyArray<ReportPostType>

    /** How many posts the channels published in the week. */
    @Field(() => Int)
    postCount!: number

    /** The advice of the week; null without engagement or when the model gave none. */
    @Field(() => ReportSuggestionType, { nullable: true })
    suggestion!: ReportSuggestionType | null
}
