import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The parameter names a ZNS renewal template declares; an empty name leaves that field out. */
export class ZnsRenewalParamsType {
    /** The parameter of the customer name. */
    @Field(() => String)
    customerName!: string

    /** The parameter of the plan. */
    @Field(() => String)
    plan!: string

    /** The parameter of the end date of the term. */
    @Field(() => String)
    endDate!: string

    /** The parameter of the amount. */
    @Field(() => String)
    amount!: string

    /** The parameter of the transfer content. */
    @Field(() => String)
    transferContent!: string

    /** The parameter of the invoice number. */
    @Field(() => String)
    invoiceNumber!: string
}
