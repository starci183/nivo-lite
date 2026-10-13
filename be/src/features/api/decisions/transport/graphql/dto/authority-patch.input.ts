import { Field, InputType, Int } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The changed fields of the authority sheet. */
export class AuthorityPatchInput {
    /** The business policies. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(8000)
    policies?: string

    /** How replies are written. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(4000)
    reply_style?: string

    /** The brand voice. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(4000)
    brand_voice?: string

    /** What the agent must always ask about first. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(4000)
    limits_note?: string

    /** The monthly revenue goal, VND; null clears it. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000000)
    goal_revenue_vnd?: number | null

    /** The new-customer goal; null clears it. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000)
    goal_new_customers?: number | null

    /** The first-reply goal, minutes; null clears it. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    goal_first_reply_minutes?: number | null

    /** Free note on the goals. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(2000)
    goal_note?: string
}
