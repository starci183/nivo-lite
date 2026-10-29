import { IsString, MaxLength, MinLength } from "class-validator"

/** A password link spent with a new password. */
export class ResetRequest {
    /** The token from the link. */
    @IsString()
    @MinLength(32)
    @MaxLength(128)
    token!: string

    /** The new password. */
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password!: string
}
