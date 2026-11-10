import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What agentWorkflowDiff takes. */
export class AgentWorkflowDiffInput {
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

    /** The version to read. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(100000)
    number!: number

    /** What to compare with: previous, version or template. */
    @Field(() => String)
    @IsString()
    @IsIn(["previous", "version", "template"])
    @MaxLength(20)
    against!: string

    /** The version (or template version) to compare with; the workflow's own template version when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100000)
    againstNumber?: number | null
}
