import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** The invoice that bills a handed-off order. */
export class SalesHandoffInvoiceType {
    /** The no. */
    @Field(() => String)
    no!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** The amount vnd. */
    @Field(() => Float)
    amountVnd!: number

    /** The issued at. */
    @Field(() => String, { nullable: true })
    issuedAt!: string | null

    /** The paid at. */
    @Field(() => String, { nullable: true })
    paidAt!: string | null
}
