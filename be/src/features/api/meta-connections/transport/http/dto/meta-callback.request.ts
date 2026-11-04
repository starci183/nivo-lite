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

    /** The numeric code Facebook adds to a refused login. */
    @IsOptional()
    @IsString()
    @MaxLength(20)
    error_code?: string

    /** Facebook's words for a refused login. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    error_description?: string

    /** Why Facebook refused the login, for example user_denied. */
    @IsOptional()
    @IsString()
    @MaxLength(100)
    error_reason?: string
}
