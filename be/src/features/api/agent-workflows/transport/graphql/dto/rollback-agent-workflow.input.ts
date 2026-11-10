import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What rollbackAgentWorkflow takes. */
export class RollbackAgentWorkflowInput {
    /** The installation whose agent holds the workflows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The workflow. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workflowId!: string

    /** The version to go back to. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(100000)
    number!: number

    /** Why the version was made, as the history shows it. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    note!: string

    /** The newest version number the caller read; a newer one refuses the change. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    expectedLatest?: number | null
}
