import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A purchased lot and its remaining credits. */
export class CreditTopupLotType {
    /** Credits originally purchased. */
    @Field(() => Float)
    credits!: number

    /** The price paid in VND. */
    @Field(() => Float)
    priceVnd!: number

    /** When the lot was purchased, ISO 8601. */
    @Field()
    purchasedAt!: string

    /** When the credits expire, ISO 8601. */
    @Field()
    expiresAt!: string

    /** Credits still spendable. */
    @Field(() => Float)
    creditsRemaining!: number
}
