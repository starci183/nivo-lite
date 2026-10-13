import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One payment order. */
export class AdminOrderType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The order code. */
    @Field()
    orderCode!: string

    /** The plan code. */
    @Field()
    planCode!: string

    /** The amount vnd. */
    @Field(() => Float)
    amountVnd!: number

    /** The status. */
    @Field()
    status!: string

    /** The created at. */
    @Field()
    createdAt!: string

    /** The paid at. */
    @Field(() => String, { nullable: true })
    paidAt!: string | null
}
