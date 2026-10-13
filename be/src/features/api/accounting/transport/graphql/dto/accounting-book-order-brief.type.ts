import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Book Order Brief returned by GraphQL. */
export class AccountingBookOrderBriefType {
    /** order No. */
    @Field(() => String)
    orderNo!: string

    /** items. */
    @Field(() => String)
    items!: string

    /** amount Vnd. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** status. */
    @Field(() => String)
    status!: string
}
