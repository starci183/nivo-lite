import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP request that saves the changed fields of the authority sheet. */
export class UpdateAuthorityRequest {
    /** The business policies. */
    @IsOptional()
    @IsString()
    @MaxLength(8000)
    policies?: string

    /** How replies are written. */
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    reply_style?: string

    /** The brand voice. */
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    brand_voice?: string

    /** What the agent must always ask about first. */
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    limits_note?: string

    /** The monthly revenue goal, VND; null clears it. */
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000000)
    goal_revenue_vnd?: number | null

    /** The new-customer goal; null clears it. */
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000)
    goal_new_customers?: number | null

    /** The first-reply goal, minutes; null clears it. */
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    goal_first_reply_minutes?: number | null

    /** Free note on the goals. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    goal_note?: string
}
