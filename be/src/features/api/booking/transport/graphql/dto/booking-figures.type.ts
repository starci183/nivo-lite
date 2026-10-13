import { Field, ObjectType, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking figures view. */
export class BookingFiguresType {
    /** The bookings today. */
    @Field(() => Int)
    bookingsToday!: number

    /** The no show pct30d. */
    @Field(() => Float, { nullable: true })
    noShowPct30d!: number | null

    /** The finished30d. */
    @Field(() => Int)
    finished30d!: number

    /** The utilisation pct. */
    @Field(() => Float, { nullable: true })
    utilisationPct!: number | null

    /** The deposits pending. */
    @Field(() => Int)
    depositsPending!: number

    /** The deposits pending vnd. */
    @Field(() => Float)
    depositsPendingVnd!: number
}
