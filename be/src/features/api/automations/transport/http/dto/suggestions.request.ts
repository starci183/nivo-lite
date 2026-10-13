import { IsOptional, Matches, MaxLength } from "class-validator"

/** The query of the suggestions: the module just installed, or the workspace-wide templates when absent. */
export class SuggestionsRequest {
    /** The module key; empty for the workspace-wide templates. */
    @IsOptional()
    @Matches(/^[a-z][a-z0-9_]{1,40}$/u)
    @MaxLength(41)
    module = ""
}
