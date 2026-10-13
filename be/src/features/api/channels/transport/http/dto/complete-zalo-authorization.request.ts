import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that finishes a Zalo authorization with what Zalo returned the browser with. */
export class CompleteZaloAuthorizationRequest {
    /** The state the authorization started with: the connection id and the one-time nonce. */
    @IsString()
    @MaxLength(200)
    state!: string

    /** The authorization code to exchange for tokens. */
    @IsString()
    @MaxLength(2000)
    code!: string

    /** The OA id Zalo reports, when it does. */
    @IsOptional()
    @IsString()
    @MaxLength(100)
    oaId?: string
}
