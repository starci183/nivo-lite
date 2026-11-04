import { Field, Float, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, ValidateNested } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"
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

    /** `number`, `text`, `toggle` or `textarea`. */
    @Field(() => String)
    @IsIn(["number", "text", "toggle", "textarea"])
    @MaxLength(20)
    kind!: "number" | "text" | "toggle" | "textarea"

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
}
