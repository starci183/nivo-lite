import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded query Google redirects the browser back with. */
export class GoogleCallbackQuery {
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
}
