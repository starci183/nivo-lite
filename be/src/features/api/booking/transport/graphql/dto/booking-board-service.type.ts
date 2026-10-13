import { Field, ObjectType, Float, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking board service view. */
export class BookingBoardServiceType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The description. */
    @Field(() => String)
    description!: string

    /** The duration min. */
    @Field(() => Int)
    durationMin!: number

    /** The buffer min. */
    @Field(() => Int)
    bufferMin!: number

    /** The price vnd. */
    @Field(() => Float, { nullable: true })
    priceVnd!: number | null

    /** The resource kind. */
    @Field(() => String, { nullable: true })
    resourceKind!: string | null

    /** The followup days. */
    @Field(() => Int, { nullable: true })
    followupDays!: number | null

    /** The active. */
    @Field(() => Boolean)
    active!: boolean
}
