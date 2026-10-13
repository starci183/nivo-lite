import { IsObject, IsOptional, IsString, MaxLength } from "class-validator"

/** How a workflow reports that its run ended. */
export class CompleteRunRequest {
    /** `done`, `failed` or `skipped`. */
    @IsOptional()
    @IsString()
    @MaxLength(16)
    status?: string

    /** A line of text. */
    @IsOptional()
    @IsString()
    @MaxLength(600)
    summary?: string

    /** Counters and details. */
    @IsOptional()
    @IsObject()
    result?: object
}
