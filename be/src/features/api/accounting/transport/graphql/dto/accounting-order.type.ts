import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Order returned by GraphQL. */
export class AccountingOrderType {
    /** id. */
    @Field(() => String)
    id!: string

    /** order No. */
    @Field(() => String)
    orderNo!: string

    /** items. */
    @Field(() => String)
    items!: string

    /** amount. */
    @Field(() => Float, { nullable: true })
    amount!: number | null

    /** origin. */
    @Field(() => String)
    origin!: string

    /** customer. */
    @Field(() => String, { nullable: true })
    customer!: string | null

    /** created At. */
    @Field(() => String)
    createdAt!: string
}
