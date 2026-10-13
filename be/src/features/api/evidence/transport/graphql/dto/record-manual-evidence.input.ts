import { Field, Float, InputType } from "@nestjs/graphql"
import { IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The money the owner knows arrived. */
export class RecordManualEvidenceInput {
    /** Whole dong, greater than zero. */
    @Field(() => Float)
    @IsInt()
    @Min(1)
    @Max(1000000000000)
    amount!: number

    /** The day the money arrived, yyyy-mm-dd. */
    @Field(() => String)
    @IsISO8601({ strict: true })
    @MinLength(10)
    @MaxLength(10)
    date!: string

    /** What the transfer said. */
    @Field(() => String)
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    content!: string

    /** A note. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The payer. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(120)
    payer?: string
}
