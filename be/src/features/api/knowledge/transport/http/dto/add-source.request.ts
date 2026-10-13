import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that adds a document to the knowledge of the workspace the caller names. */
export class AddSourceRequest {
    /** text, faq, file or url. */
    @IsString()
    @MaxLength(20)
    kind!: string

    /** The title; a link or file without one is titled from its address or name. */
    @IsString()
    @MaxLength(300)
    title!: string

    /** The text of a note or Q&A list. */
    @IsOptional()
    @IsString()
    @MaxLength(200000)
    content?: string

    /** The address of a link source. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    url?: string

    /** The storage object of an uploaded file. */
    @IsOptional()
    @IsString()
    @MaxLength(600)
    storagePath?: string

    /** The topic label. */
    @IsOptional()
    @IsString()
    @MaxLength(120)
    topic?: string

    /** The tags. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    tags?: Array<string>

    /** The module (agent type) the document is for; omitted means every module. */
    @IsOptional()
    @IsString()
    @MaxLength(60)
    module?: string

    /** The agent instance that alone reads the document. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string

    /** public or internal. */
    @IsOptional()
    @IsString()
    @MaxLength(20)
    visibility?: string

    /** Where it came from: a folder, a ZIP, the Google Picker. */
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    origin?: string
}
