import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names the message to forward and the room it goes to. */
export class ChatForwardInput {
    /** The message. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    messageId!: string

    /** The room it goes to; the caller must sit in it. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string
}
