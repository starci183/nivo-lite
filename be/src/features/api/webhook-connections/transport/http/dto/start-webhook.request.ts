import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the StartWebhook operation. */
export class StartWebhookBody {
    /** The name sent by the caller. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The url sent by the caller. */
    @IsString()
    @MaxLength(2048)
    url!: string

    /** The events sent by the caller. */
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(40, { each: true })
    events!: string[]
}
