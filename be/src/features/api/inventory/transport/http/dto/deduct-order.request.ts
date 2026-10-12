import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request of take a confirmed order out of stock. */
export class DeductOrderRequest {
    /** The order id: the idempotency key of the deduction. */
    @IsString()
    @MaxLength(64)
    orderId!: string

    /** The order number shown to people. */
    @IsString()
    @MaxLength(60)
    orderNo!: string

    /** The ordered items as the customer wrote them. */
    @IsString()
    @MaxLength(5000)
    items!: string
}
