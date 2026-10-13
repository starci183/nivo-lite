import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for AgentChatMessages. */
export class AgentChatMessagesInput {
    /** The conversationId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    conversationId!: string
}
