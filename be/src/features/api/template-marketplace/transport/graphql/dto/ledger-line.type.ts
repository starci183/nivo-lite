import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the ledger of a creator. */
export class LedgerLineType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The template. */
    @Field(() => String)
    templateKey!: string

    /** The paid order. */
    @Field(() => ID)
    orderId!: string

    /** `creator_share` or `platform_fee`. */
    @Field(() => String)
    kind!: string

    /** The amount in VND. */
    @Field(() => Int)
    amountVnd!: number

    /** When it was written, ISO 8601. */
    @Field(() => String)
    createdAt!: string
}
