import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One order of the customer. */
export class InboxOrderType {
    /** The order id. */
    @Field(() => ID)
    id!: string

    /** The order number. */
    @Field()
    orderNo!: string

    /** The order status. */
    @Field()
    status!: string

    /** The value in VND, or null. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** What it holds, in words. */
    @Field(() => String, { nullable: true })
    itemsText!: string | null

    /** When it was made, ISO 8601. */
    @Field()
    createdAt!: string
}
