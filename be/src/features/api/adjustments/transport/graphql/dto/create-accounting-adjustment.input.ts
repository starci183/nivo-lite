import { Field, Float, InputType } from "@nestjs/graphql"
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** A bounded correction request, with an optional corrected VND amount. */
export class CreateAccountingAdjustmentInput {
    /** The kind of workspace record being corrected. */
    @Field(() => String)
    @IsIn(["invoice", "transaction"])
    targetType!: "invoice" | "transaction"
    /** The invoice or payment id. */
    @Field(() => String)
    @IsUUID()
    @MaxLength(36)
    targetId!: string
    /** The basis of the correction. */
    @Field(() => String)
    @IsString()
    @MinLength(5)
    @MaxLength(1000)
    note!: string
    /** The new amount recorded beside the original, or null for a note only. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber({ allowInfinity: false, allowNaN: false })
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    correctedAmount?: number | null
}
