import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that changes the metadata of a document. */
export class UpdateSourceRequest {
    /** A new title. */
    @IsOptional()
    @IsString()
    @MaxLength(300)
    title?: string

    /** A new topic; an empty text clears it. */
    @IsOptional()
    @IsString()
    @MaxLength(120)
    topic?: string

    /** New tags. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    tags?: Array<string>

    /** A new module; an empty text means every module. */
    @IsOptional()
    @IsString()
    @MaxLength(60)
    module?: string

    /** public or internal. */
    @IsOptional()
    @IsString()
    @MaxLength(20)
    visibility?: string
}
