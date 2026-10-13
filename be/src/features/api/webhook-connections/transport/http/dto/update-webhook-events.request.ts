import { ArrayMaxSize, IsArray, IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the UpdateWebhookEvents operation. */
export class UpdateWebhookEventsBody {
    /** The events sent by the caller. */
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(40, { each: true })
    events!: string[]
}
