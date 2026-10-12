import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the ConnectTelegram operation. */
export class ConnectTelegramBody {
    /** The name sent by the caller. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The token sent by the caller. */
    @IsString()
    @MaxLength(200)
    token!: string
}
