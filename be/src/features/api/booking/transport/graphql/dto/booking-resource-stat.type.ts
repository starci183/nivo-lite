import { Field, ObjectType, Float, ID } from "@nestjs/graphql"

@ObjectType()
/** The booking resource stat view. */
export class BookingResourceStatType {
    /** The resource id. */
    @Field(() => ID)
    resourceId!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The open min. */
    @Field(() => Float)
    openMin!: number

    /** The booked min. */
    @Field(() => Float)
    bookedMin!: number

    /** The pct. */
    @Field(() => Float)
    pct!: number
}
