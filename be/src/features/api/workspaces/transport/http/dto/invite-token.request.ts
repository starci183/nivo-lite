import { IsString, MaxLength, MinLength } from "class-validator"

/** The path parameter that carries the token of an invitation link. */
export class InviteTokenRequest {
    /** The token inside the invitation link. */
    @IsString()
    @MinLength(16)
    @MaxLength(200)
    token!: string
}
