import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean } from "class-validator"
import { ChatTargetInput } from "./chat-target.input"

@InputType()
/** Sets only the current member's preference for this conversation. */
export class ChatMuteInput extends ChatTargetInput {
    /** True means the frontend uses a red dot for unread activity. */
    @Field(() => Boolean)
    @IsBoolean()
    muted!: boolean
}
