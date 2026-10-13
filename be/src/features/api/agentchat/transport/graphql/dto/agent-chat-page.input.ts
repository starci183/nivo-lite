import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, IsOptional, IsBoolean, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for AgentChatPage. */
export class AgentChatPageInput {
    /** The agentId argument. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    agentId!: string

    /** The welcome argument. */
    @Field(() => Boolean, { defaultValue: false })
    @IsOptional()
    @IsBoolean()
    welcome: boolean = false
}
