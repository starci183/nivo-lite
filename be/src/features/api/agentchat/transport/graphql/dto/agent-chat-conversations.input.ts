import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for AgentChatConversations. */
export class AgentChatConversationsInput {
    /** The agentId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    agentId!: string
}
