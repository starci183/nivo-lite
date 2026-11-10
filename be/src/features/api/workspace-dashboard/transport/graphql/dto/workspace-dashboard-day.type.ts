import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One day of the chart, in Vietnam time. */
export class WorkspaceDashboardDayType {
    /** The day, YYYY-MM-DD. */
    @Field()
    day!: string

    /** Matched payments received that day, VND. */
    @Field(() => Float)
    revenueVnd!: number

    /** Orders placed that day. */
    @Field(() => Int)
    orders!: number
}
