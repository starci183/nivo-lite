import { Field, Float, InputType } from "@nestjs/graphql"
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** One bounded named text or number in a Sales proposal. */
export class SalesFieldValueInput {
    /** The proposal's field name. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(64)
    name!: string

    /** The text value, when present. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    text?: string

    /** The number value, when present. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber({ allowNaN: false, allowInfinity: false })
    @Min(-1000000000000)
    @Max(1000000000000)
    number?: number
}
