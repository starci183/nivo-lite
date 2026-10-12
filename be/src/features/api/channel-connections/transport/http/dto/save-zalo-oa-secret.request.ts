import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the SaveZaloOaSecret operation. */
export class SaveZaloOaSecretBody {
    /** The oaSecret sent by the caller. */
    @IsString()
    @MaxLength(400)
    oaSecret!: string
}
