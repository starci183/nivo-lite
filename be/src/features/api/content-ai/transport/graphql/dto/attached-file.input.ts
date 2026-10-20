import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

/** The most base64 characters one attached guideline may take: twenty megabytes of bytes. */
export const ATTACHED_FILE_BASE64_MAX = 28_000_000

@InputType()
/** One file attached in the setup chat: its name and its bytes as base64. */
export class AttachedFileInput {
    /** The file name, with its extension. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name!: string

    /** The bytes as base64. */
    @Field()
    @IsString()
    @MaxLength(ATTACHED_FILE_BASE64_MAX)
    contentBase64!: string
}
