import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"
import { LEAD_STAGES } from "@modules/domain/public-api"
import type { PublicLeadStage } from "@modules/domain/public-api"

/** The query string of GET /api/v1/leads. */
export class ListLeadsRequest {
    /** Only customers of this stage. */
    @IsOptional()
    @IsIn(LEAD_STAGES)
    @MaxLength(20)
    status?: PublicLeadStage

    /** The most customers to answer; a number outside 1 to 200 is clamped. */
    @IsOptional()
    @IsString()
    @MaxLength(10)
    limit?: string
}
