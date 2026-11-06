import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one message of a room to pin or unpin. */
export class ChatPinInput {
    /** The room. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** The message. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    messageId!: string
}
