import { Field, ObjectType, Float, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking board wait view. */
export class BookingBoardWaitType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The customer. */
    @Field(() => String)
    customer!: string

    /** The phone. */
    @Field(() => String, { nullable: true })
    phone!: string | null

    /** The service. */
    @Field(() => String)
    service!: string

    /** The from ms. */
    @Field(() => Float)
    fromMs!: number

    /** The to ms. */
    @Field(() => Float)
    toMs!: number

    /** The party. */
    @Field(() => Int)
    party!: number

    /** The status. */
    @Field(() => String)
    status!: string
}
