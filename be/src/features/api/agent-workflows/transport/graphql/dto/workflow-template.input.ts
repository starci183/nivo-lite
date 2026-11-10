import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** What workflowTemplate takes. */
export class WorkflowTemplateInput {
    /** The template. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    @MinLength(3)
    templateId!: string

    /** The language of the names; Vietnamese unless en is named. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["vi", "en"])
    @MaxLength(2)
    locale?: string | null
}
