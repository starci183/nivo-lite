import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"
import { FieldValueInput } from "./field-value.input"

@InputType()
/** What a person changed on a proposal before approving it. */
export class WorkEditsInput {
    /** A new draft. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(10000)
    draft?: string

    /** A new amount, VND; null clears it. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    amount_vnd?: number | null

    /** Changed fields. */
    @Field(() => [FieldValueInput], { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsArray()
    @ArrayMaxSize(30)
    @ValidateNested({ each: true })
    @Type(() => FieldValueInput)
    fields?: Array<FieldValueInput>

    /** The invoice the owner chose among the candidates. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsUUID("4")
    @MaxLength(36)
    candidateId?: string
}
