import { IsIn, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of put a purchase order before the owner to send. */
export class RequestSendRequest {
    /** The purchase order. */
    @IsUUID("4")
    @MaxLength(36)
    poId!: string

    /** Whether to send the order or remind the supplier. */
    @IsIn(["order", "reminder"])
    kind!: "order" | "reminder"
}
