import { IsOptional, Matches, MaxLength } from "class-validator"

/** The query of the run history: one template, or every template when absent. */
export class RunsRequest {
    /** The template key; empty for every template. */
    @IsOptional()
    @Matches(/^[a-z][a-z0-9_-]{2,60}$/u)
    @MaxLength(61)
    template = ""
}
