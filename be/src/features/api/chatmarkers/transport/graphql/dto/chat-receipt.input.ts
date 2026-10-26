import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"
import { ChatTargetInput } from "./chat-target.input"

@InputType()
/** A client receipt bounded by an actual message in the target chat. */
export class ChatReceiptInput extends ChatTargetInput {
    /** The last message fetched or read, never a future wall-clock timestamp. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    messageId!: string
}
