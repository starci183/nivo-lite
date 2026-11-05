import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsString, MaxLength, MinLength, ValidateNested } from "class-validator"
import { TemplateTextInput } from "./template-text.input"

@InputType()
/** One choice of a `choice` setting. */
export class TemplateParameterOptionInput {
    /** The value kept when the buyer picks it. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    value!: string

    /** The label in both product languages. */
    @Field(() => TemplateTextInput)
    @ValidateNested()
    @Type(() => TemplateTextInput)
    label!: TemplateTextInput
}
