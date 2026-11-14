import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of agentTemplateNodeRequests. */
export class GetAgentTemplateNodeRequestsInput {
    /** The workflow template. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    templateId!: string

    /** The template version; the newest when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100000)
    version?: number | null
}
