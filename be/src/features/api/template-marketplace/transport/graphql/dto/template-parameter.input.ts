import { Field, Float, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateNested,
} from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"
import { TemplateParameterOptionInput } from "./template-parameter-option.input"
import { TemplateTextInput } from "./template-text.input"

@InputType()
/** One setting the buyer fills in. */
export class TemplateParameterInput {
    /** The key. */
    @Field(() => String)
    @IsString()
    @Matches(/^[a-z]\w{0,39}$/)
    @MaxLength(40)
    key!: string

    /** `number`, `text`, `toggle`, `textarea`, `time` or `choice`. */
    @Field(() => String)
    @IsIn(["number", "text", "toggle", "textarea", "time", "choice"])
    @MaxLength(20)
    kind!: "number" | "text" | "toggle" | "textarea" | "time" | "choice"

    /** The label. */
    @Field(() => TemplateTextInput)
    @ValidateNested()
    @Type(() => TemplateTextInput)
    label!: TemplateTextInput

    /** A line of help. */
    @Field(() => TemplateTextInput, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @ValidateNested()
    @Type(() => TemplateTextInput)
    hint?: TemplateTextInput

    /** The smallest number. */
    @Field(() => Float, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsNumber()
    min?: number

    /** The biggest number. */
    @Field(() => Float, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsNumber()
    max?: number

    /** True when the buyer must fill it. */
    @Field(() => Boolean)
    @IsBoolean()
    required!: boolean

    /** The default value as text (a number, a text or `true`/`false`). */
    @Field(() => String)
    @IsString()
    @MaxLength(2000)
    defaultValue!: string

    /** The choices of a `choice` setting. */
    @Field(() => [TemplateParameterOptionInput], { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => TemplateParameterOptionInput)
    options?: Array<TemplateParameterOptionInput>
}
