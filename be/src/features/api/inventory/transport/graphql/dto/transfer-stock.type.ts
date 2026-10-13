import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What moving goods between two locations answers. */
export class TransferStockType {
    /** The level left at the source. */
    @Field(() => Float)
    from!: number

    /** The level at the target. */
    @Field(() => Float)
    to!: number
}
