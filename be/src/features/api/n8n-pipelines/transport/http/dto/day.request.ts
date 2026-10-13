import { IsOptional, Matches, MaxLength } from "class-validator"

/** The day a data route is asked for. */
export class DayRequest {
    /** The day, yyyy-mm-dd; empty for today. */
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/u)
    @MaxLength(10)
    date = ""
}
