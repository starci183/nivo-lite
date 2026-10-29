import { IsString, MaxLength, MinLength } from "class-validator"

/** A confirmation link spent. */
export class ConfirmRequest {
    /** The token from the link. */
    @IsString()
    @MinLength(32)
    @MaxLength(128)
    token!: string
}
