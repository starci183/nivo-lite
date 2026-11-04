import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded query Google redirects the browser back with. */
export class GoogleCallbackRequest {
    /** The signed state. */
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    state?: string

    /** The consent code. */
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    code?: string

    /** The error Google reported. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    error?: string

    /** The scopes Google granted, space separated; read from the token answer, not from here. */
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    scope?: string

    /** The issuer Google adds to the redirect. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    iss?: string

    /** The Google session index Google adds to the redirect. */
    @IsOptional()
    @IsString()
    @MaxLength(20)
    authuser?: string

    /** The prompt Google shows, echoed on the redirect. */
    @IsOptional()
    @IsString()
    @MaxLength(50)
    prompt?: string

    /** The hosted domain of a Workspace account, echoed on the redirect. */
    @IsOptional()
    @IsString()
    @MaxLength(255)
    hd?: string
}
