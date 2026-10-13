import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the GoogleAuthorize operation. */
export class GoogleAuthorizeBody {
    /** The returnTo sent by the caller. */
    @IsString()
    @MaxLength(200)
    returnTo!: string
}
