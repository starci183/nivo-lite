import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, IsIn, IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for StartAgentChatConversation. */
export class StartAgentChatConversationInput {
    /** The agentId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    agentId!: string

    /** The kind argument. */
    @Field()
    @IsIn(["test", "customer"])
    kind!: "test" | "customer"

    /** The visitorName argument. */
    @Field(() => String, { nullable: true, defaultValue: null })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    visitorName: string | null = null
}
