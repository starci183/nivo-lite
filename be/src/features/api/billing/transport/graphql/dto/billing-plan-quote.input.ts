import { Field, Float, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The plan selection to price. */
export class BillingPlanQuoteInput {
    /** The plan code. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]{1,40}$/)
    planCode!: string

    /** Pay month by month or a year at once; monthly when absent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["monthly", "annual"])
    cycle?: "monthly" | "annual" | null

    /** The per-seat credit level picked on a per-seat plan. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100_000_000)
    tierCredits?: number | null

    /** The seats of a per-seat plan. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    seats?: number | null
}
