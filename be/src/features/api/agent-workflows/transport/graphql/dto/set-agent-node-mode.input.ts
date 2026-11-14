import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** What setAgentNodeMode takes: one node of one workflow of the installation's agent, and its mode. */
export class SetAgentNodeModeInput {
    /** The installation whose agent holds the workflow. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The workflow. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workflowId!: string

    /** The node, by its key in the workflow's running graph. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    nodeKey!: string

    /** `auto` (the node's calls run) or `ask` (each write waits for a person's approval on a card in /chat). */
    @Field(() => String)
    @IsIn(["auto", "ask"])
    mode!: string

    /** The newest version number the caller read; a newer one refuses the change. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    expectedLatest?: number | null
}
