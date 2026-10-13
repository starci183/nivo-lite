import { Field, ObjectType, Float, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking board entry view. */
export class BookingBoardEntryType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The customer. */
    @Field(() => String)
    customer!: string

    /** The phone. */
    @Field(() => String, { nullable: true })
    phone!: string | null

    /** The service id. */
    @Field(() => ID)
    serviceId!: string

    /** The service. */
    @Field(() => String)
    service!: string

    /** The resource id. */
    @Field(() => ID)
    resourceId!: string

    /** The start ms. */
    @Field(() => Float)
    startMs!: number

    /** The end ms. */
    @Field(() => Float)
    endMs!: number

    /** The date. */
    @Field(() => String)
    date!: string

    /** The start min. */
    @Field(() => Int)
    startMin!: number

    /** The end min. */
    @Field(() => Int)
    endMin!: number

    /** The start clock. */
    @Field(() => String)
    startClock!: string

    /** The end clock. */
    @Field(() => String)
    endClock!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** The holds slot. */
    @Field(() => Boolean)
    holdsSlot!: boolean

    /** The party. */
    @Field(() => Int)
    party!: number

    /** The price vnd. */
    @Field(() => Float, { nullable: true })
    priceVnd!: number | null

    /** The deposit vnd. */
    @Field(() => Float)
    depositVnd!: number

    /** The deposit status. */
    @Field(() => String)
    depositStatus!: string

    /** The fee vnd. */
    @Field(() => Float)
    feeVnd!: number

    /** The checked in. */
    @Field(() => Boolean)
    checkedIn!: boolean

    /** The note. */
    @Field(() => String)
    note!: string

    /** The conflict note. */
    @Field(() => String)
    conflictNote!: string

    /** The source. */
    @Field(() => String)
    source!: string

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The reschedules. */
    @Field(() => Int)
    reschedules!: number
}
