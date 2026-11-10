import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What agentWorkflowTemplatePreview takes. */
export class AgentWorkflowTemplatePreviewInput {
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

    /** The template version offered. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(100000)
    templateVersion!: number

    /** The language of the names; Vietnamese unless en is named. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["vi", "en"])
    @MaxLength(2)
    locale?: string | null
}
