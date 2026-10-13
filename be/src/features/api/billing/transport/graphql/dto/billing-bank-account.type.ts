import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The bank account that receives payments. */
export class BillingBankAccountType {
    /** The account number. */
    @Field(() => String)
    account!: string

    /** The VietQR bank code. */
    @Field(() => String)
    bank!: string

    /** The account holder. */
    @Field(() => String)
    holder!: string
}
