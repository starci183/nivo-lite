import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A credit pack on sale. */
export class CreditPackType {
    /** The pack code. */
    @Field()
    code!: string

    /** Credits added by the pack. */
    @Field(() => Float)
    credits!: number

    /** The price in VND. */
    @Field(() => Float)
    priceVnd!: number

    /** The catalogue display order. */
    @Field(() => Int)
    sort!: number
}
