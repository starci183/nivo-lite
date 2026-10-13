import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The request selector, scoped by the workspace header and authenticated caller. */
export class PaymentOrderRequestStatusInput {
    /** The request id returned by requestPaymentOrder. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    @MaxLength(36)
    id!: string
}
