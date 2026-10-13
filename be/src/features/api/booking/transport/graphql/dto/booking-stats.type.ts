import { Field, ObjectType, Float, Int } from "@nestjs/graphql"
import { BookingResourceStatType } from "./booking-resource-stat.type"
import { BookingStatusCountType } from "./booking-status-count.type"

@ObjectType()
/** The booking stats view. */
export class BookingStatsType {
    /** The by resource. */
    @Field(() => [BookingResourceStatType])
    byResource!: ReadonlyArray<BookingResourceStatType>

    /** The by status. */
    @Field(() => [BookingStatusCountType])
    byStatus!: ReadonlyArray<BookingStatusCountType>

    /** The no show pct. */
    @Field(() => Float)
    noShowPct!: number

    /** The done revenue vnd. */
    @Field(() => Float)
    doneRevenueVnd!: number

    /** The total. */
    @Field(() => Int)
    total!: number
}
