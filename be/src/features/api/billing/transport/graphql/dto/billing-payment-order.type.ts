import { Field, ObjectType, ID, Float } from "@nestjs/graphql"
import { BillingPaymentDetailsType } from "./billing-payment-details.type"
import { BillingBankAccountType } from "./billing-bank-account.type"

@ObjectType()
/** A payment order with backend computed QR and account details. */
export class BillingPaymentOrderType {
    /** The order id. */
    @Field(() => ID)
    id!: string

    /** The paying workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The plan code. */
    @Field(() => String)
    planCode!: string

    /** The amount to transfer in VND. */
    @Field(() => Float)
    amountVnd!: number

    /** The identifying transfer content. */
    @Field(() => String)
    orderCode!: string

    /** The order status. */
    @Field(() => String)
    status!: string

    /** When it expires, ISO 8601. */
    @Field(() => String)
    expiresAt!: string

    /** When it was settled, ISO 8601. */
    @Field(() => String, { nullable: true })
    paidAt!: string | null

    /** When it was created, ISO 8601. */
    @Field(() => String)
    createdAt!: string

    /** Plan, upgrade or topup. */
    @Field(() => String)
    kind!: string

    /** The top-up pack. */
    @Field(() => String, { nullable: true })
    packCode!: string | null

    /** Frozen sale details. */
    @Field(() => BillingPaymentDetailsType)
    detail!: BillingPaymentDetailsType

    /** The VietQR image URL. */
    @Field(() => String)
    qrUrl!: string

    /** The receiving bank account. */
    @Field(() => BillingBankAccountType)
    bank!: BillingBankAccountType
}
