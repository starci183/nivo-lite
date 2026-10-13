import { IsUUID, MaxLength } from "class-validator"

/** The body that asks for a command card for an owner message. */
export class ProposeCommandRequest {
    /** The owner message, already stored in the Office thread. */
    @IsUUID("4")
    @MaxLength(36)
    messageId!: string
}
