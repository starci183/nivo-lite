import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What createAgentWorkflow takes. */
export class CreateAgentWorkflowInput {
    /** The installation whose agent holds the workflows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The template to copy; none makes a blank workflow. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    templateId?: string | null

    /** The template version to copy; the newest when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100000)
    templateVersion?: number | null

    /** The name of a blank workflow. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string | null

    /** The language of the names; Vietnamese unless en is named. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["vi", "en"])
    @MaxLength(2)
    locale?: string | null
}
