import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, IsString, MinLength, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for SendAgentChatMessage. */
export class SendAgentChatMessageInput {
    /** The conversationId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    conversationId!: string

    /** The body argument. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    body!: string
}
