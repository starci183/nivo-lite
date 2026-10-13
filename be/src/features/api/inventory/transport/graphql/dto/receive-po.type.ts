import { Field, Int, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What receiving goods against a purchase order answers. */
export class ReceivePoType {
    /** The order status after the receipt. */
    @Field(() => String)
    status!: string

    /** Lines received. */
    @Field(() => Int)
    received!: number

    /** The lines whose price differed from the order. */
    @Field(() => [String])
    priceChanges!: ReadonlyArray<string>

    /** The value of the goods. */
    @Field(() => Float)
    payableVnd!: number

    /** Whether the payable went to Accounting. */
    @Field(() => Boolean)
    handedToAccounting!: boolean
}
