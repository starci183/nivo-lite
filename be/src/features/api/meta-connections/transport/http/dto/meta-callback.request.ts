import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded query Meta redirects the browser back with. */
export class MetaCallbackRequest {
    /** The signed state. */
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    state?: string

    /** The login code. */
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    code?: string

    /** The error Meta reported. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    error?: string
}
