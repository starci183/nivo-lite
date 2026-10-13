import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded query Meta redirects the browser back with. */
export class MetaCallbackQuery {
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

/** The bounded hub query of the webhook verification. */
export class MetaChallengeQueryParams {
    /** The hub mode. */
    @IsOptional()
    @IsString()
    @MaxLength(40)
    "hub.mode"?: string

    /** The hub verify token. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    "hub.verify_token"?: string

    /** The hub challenge. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    "hub.challenge"?: string
}
