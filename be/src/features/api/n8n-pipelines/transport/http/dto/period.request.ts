import { IsOptional, Matches, MaxLength } from "class-validator"

/** The month a data route is asked for. */
export class PeriodRequest {
    /** The month, yyyy-mm; empty for last month. */
    @IsOptional()
    @Matches(/^\d{4}-\d{2}$/u)
    @MaxLength(7)
    period = ""
}
