import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { AgentGraphAgreedRightInput } from "./agent-graph-agreed-right.input"

@InputType()
/** What restoreAgentGraphVersion takes. */
export class RestoreAgentGraphVersionInput {
    /** The agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The version to go back to. */
    @Field(() => String)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    versionId!: string

    /**
     * The operations on connected accounts the owner agrees this activation may bring, exactly as the refusal
     * AGENT_GRAPHS_RIGHTS_NEED_OWNER listed them; absent when nothing was asked of the owner.
     */
    @Field(() => [AgentGraphAgreedRightInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => AgentGraphAgreedRightInput)
    agreedRights?: Array<AgentGraphAgreedRightInput> | null
}
