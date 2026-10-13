import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

/** The most base64 characters one uploaded file may take: ten megabytes of bytes. */
export const UPLOADED_FILE_BASE64_MAX = 14_000_000

@InputType()
/** One file the browser sends inside a mutation: its name and its bytes as base64 (the be reads it, the browser never parses it). */
export class UploadedFileInput {
    /** The file name, with its extension. */
    @Field(() => String)
    @IsString()
    @MaxLength(255)
    name!: string

    /** The bytes of the file as base64. */
    @Field(() => String)
    @IsString()
    @MaxLength(UPLOADED_FILE_BASE64_MAX)
    contentBase64!: string
}
