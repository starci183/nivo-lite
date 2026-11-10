import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** What publishAgentWorkflowVersion takes. */
export class PublishAgentWorkflowVersionInput {
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

    /** The graph, as JSON text. */
    @Field(() => String)
    @IsString()
    @MaxLength(400000)
    @MinLength(2)
    graphJson!: string

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
