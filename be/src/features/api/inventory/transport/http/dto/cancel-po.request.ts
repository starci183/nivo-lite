import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of cancel a purchase order. */
export class CancelPoRequest {
    /** The purchase order. */
    @IsUUID("4")
    @MaxLength(36)
    poId!: string
}
