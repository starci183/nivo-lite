import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The transfer to make for a paid listing. */
export class TemplateOrderType {
    /** The order. */
    @Field(() => ID)
    orderId!: string

    /** The transfer content that identifies the order. */
    @Field(() => String)
    orderCode!: string

    /** The amount in VND. */
    @Field(() => Int)
    amountVnd!: number

    /** When the order stops being payable, ISO 8601. */
    @Field(() => String)
    expiresAt!: string

    /** The VietQR image that pays the order. */
    @Field(() => String)
    qrUrl!: string

    /** The bank code. */
    @Field(() => String)
    bank!: string

    /** The account number. */
    @Field(() => String)
    account!: string

    /** The account holder. */
    @Field(() => String)
    holder!: string
}
