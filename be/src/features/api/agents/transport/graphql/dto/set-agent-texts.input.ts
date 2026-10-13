import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsUUID, MaxLength, ValidateNested } from "class-validator"
import { AgentTextsInput } from "./agent-texts.input"

@InputType()
/** Replaces the free texts of an agent. */
export class SetAgentTextsInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The instructions and business notes that replace the current ones. */
    @Field(() => AgentTextsInput)
    @ValidateNested()
    @Type(() => AgentTextsInput)
    texts!: AgentTextsInput
}
