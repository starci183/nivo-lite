import { Transform } from "class-transformer"
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"
import { trimmedField } from "@modules/domain/public-api"

/** The characters of the text of one knowledge source, with room for the escapes of JSON. */
const CONTENT_CHARS_MAX = 240_000

/** The JSON body of POST /api/v1/knowledge: a text source to chunk and index. */
export class AddKnowledgeRequest {
    /** The source title. */
    @Transform(({ value }) => trimmedField(value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(160)
    title!: string

    /** The text of the source; the domain refuses one longer than 120000 characters. */
    @Transform(({ value }) => trimmedField(value))
    @IsString()
    @IsNotEmpty()
    @MaxLength(CONTENT_CHARS_MAX)
    content!: string

    /** The topic. */
    @IsOptional()
    @Transform(({ value }) => trimmedField(value))
    @IsString()
    @MaxLength(80)
    topic?: string

    /** `public` lets customers be answered from it; anything else keeps it internal. */
    @IsOptional()
    @Transform(({ value }) => trimmedField(value))
    @IsString()
    @MaxLength(10)
    visibility?: string

    /** The tags; the domain keeps the first twelve. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @MaxLength(100, { each: true })
    tags?: Array<string>
}
