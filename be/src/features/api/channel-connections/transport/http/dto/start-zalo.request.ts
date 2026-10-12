import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the StartZalo operation. */
export class StartZaloBody {
    /** The name sent by the caller. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The appId sent by the caller. */
    @IsString()
    @MaxLength(60)
    appId!: string

    /** The appSecret sent by the caller. */
    @IsString()
    @MaxLength(200)
    appSecret!: string
}
