import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One add-on credit pack paid for this month. */
export class CreditPackPurchaseType {
    /** The credits added to the month's allowance. */
    @Field(() => Float)
    credits!: number

    /** The price paid in VND. */
    @Field(() => Float)
    priceVnd!: number

    /** When it was paid, ISO 8601. */
    @Field()
    purchasedAt!: string
}
