import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Reads the delivery progress of a stored human reply. */
export class ChatReplyStatusInput {
    /** The message id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    messageId!: string
}
