import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that reads a document again. */
export class ReindexSourceRequest {
    /** The new text; omitted keeps the text. */
    @IsOptional()
    @IsString()
    @MaxLength(200000)
    content?: string
}
