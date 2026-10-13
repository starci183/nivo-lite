import { IsOptional, IsString, MaxLength } from "class-validator"

/** The query string of GET /api/v1/events. */
export class ListEventsRequest {
    /** Only events after this time, ISO 8601. */
    @IsOptional()
    @IsString()
    @MaxLength(40)
    since?: string

    /** The most events to answer; a number outside 1 to 500 is clamped. */
    @IsOptional()
    @IsString()
    @MaxLength(10)
    limit?: string
}
