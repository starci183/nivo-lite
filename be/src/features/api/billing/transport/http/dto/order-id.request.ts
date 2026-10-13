import { IsUUID, MaxLength } from "class-validator"

/** The path parameter that names one payment order. */
export class OrderIdRequest {
    /** The order. */
    @IsUUID("4")
    @MaxLength(36)
    orderId!: string
}
