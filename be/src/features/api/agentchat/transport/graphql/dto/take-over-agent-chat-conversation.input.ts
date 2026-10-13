import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for TakeOverAgentChatConversation. */
export class TakeOverAgentChatConversationInput {
    /** The conversationId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    conversationId!: string

    /** The take argument. */
    @Field(() => Boolean)
    @IsBoolean()
    take!: boolean

    /** The line argument. */
    @Field(() => String, { defaultValue: "" })
    @IsOptional()
    @IsString()
    @MaxLength(400)
    line: string = ""
}
