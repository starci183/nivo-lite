import { Field, Float, ID, InputType } from "@nestjs/graphql"
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
import { SalesFieldValueInput } from "./sales-field-value.input"

@InputType()
/** Bounded changes made before approving a Sales proposal. */
export class SalesWorkEditsInput {
    /** The replacement draft. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    draft?: string

    /** The new whole amount in VND; null clears it. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    amount_vnd?: number | null

    /** The named proposal fields that changed. */
    @Field(() => [SalesFieldValueInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @ValidateNested({ each: true })
    @Type(() => SalesFieldValueInput)
    fields?: Array<SalesFieldValueInput>

    /** The selected candidate invoice. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    candidateId?: string
}
