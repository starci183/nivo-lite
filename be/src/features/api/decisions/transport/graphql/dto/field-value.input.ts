import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, Float, InputType } from "@nestjs/graphql"
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** One named field of a proposal or a command payload, carrying a text or a number. */
export class FieldValueInput {
    /** The field name, as the action declares it. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(60)
    name!: string

    /** The text value. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(2000)
    text?: string

    /** The number value. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsNumber({ allowNaN: false, allowInfinity: false })
    @Min(-1000000000000)
    @Max(1000000000000)
    number?: number
}
