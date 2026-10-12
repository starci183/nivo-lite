import { IsString, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that accepts an invitation. */
export class AcceptInviteRequest {
    /** The token inside the invitation link. */
    @IsString()
    @MinLength(16)
    @MaxLength(200)
    token!: string
}
