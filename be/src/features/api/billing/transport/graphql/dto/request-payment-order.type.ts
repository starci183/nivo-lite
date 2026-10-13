import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A payment-order request accepted by the existing queue. */
export class RequestPaymentOrderType {
    /** The request id to poll. */
    @Field(() => ID)
    id!: string

    /** The initial queued state. */
    @Field(() => String)
    status!: string
}
