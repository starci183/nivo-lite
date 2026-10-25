import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsBoolean, ValidateNested } from "class-validator"
import { ChatTypingTargetInput } from "./chat-typing-target.input"

@InputType()
/** Publishes only the caller's typing hint; identities are always server-authored. */
export class SetChatTypingInput {
    /** The room or conversation. */
    @Field(() => ChatTypingTargetInput)
    @ValidateNested()
    @Type(() => ChatTypingTargetInput)
    target!: ChatTypingTargetInput

    /** Refresh while typing and send false on stop; receivers also enforce expiresAt. */
    @Field()
    @IsBoolean()
    typing!: boolean
}
