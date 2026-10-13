import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The progress or terminal outcome of the caller's payment-order request. */
export class PaymentOrderRequestStatusType {
    /** The payment-order request id. */
    @Field(() => ID)
    id!: string

    /** Queued until the worker records succeeded or failed. */
    @Field(() => String)
    status!: string

    /** The created payment order, after success. */
    @Field(() => ID, { nullable: true })
    resultId!: string | null

    /** The stable refusal or job failure code. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
