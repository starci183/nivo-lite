import { Field, Float, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator"
import type { PaymentOrderRequestKind } from "@modules/domain/payment-order-requests"

@InputType()
/** The bounded operation and target of a queued payment order. */
export class RequestPaymentOrderInput {
    /** The supported payment operation. */
    @Field(() => String)
    @IsString()
    @IsIn(["plan", "renew", "topup", "upgrade"])
    kind!: PaymentOrderRequestKind

    /** An active plan or pack code; renewal does not need a target. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]{1,40}$/)
    target?: string | null

    /** Pay month by month or a year at once (a plan order); monthly when absent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["monthly", "annual"])
    cycle?: "monthly" | "annual" | null

    /** The monthly credit allowance picked from the plan's usage tiers (a plan order). */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100_000_000)
    tierCredits?: number | null

    /** The seats of a per-seat plan (a plan order). */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    seats?: number | null
}
