import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded hub query of the Meta subscription verification. */
export class MetaChallengeRequest {
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
