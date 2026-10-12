import { IsUUID, MaxLength } from "class-validator"

/** The path parameter that names one invitation. */
export class InviteIdRequest {
    /** The invitation. */
    @IsUUID("4")
    @MaxLength(36)
    inviteId!: string
}
