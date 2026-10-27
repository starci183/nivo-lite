import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

/** The most base64 characters one uploaded contract sheet may take: ten megabytes of bytes. */
export const CONTRACT_IMPORT_FILE_BASE64_MAX = 14_000_000

@InputType()
/** One contract sheet the browser sends inside the request: its name and its bytes as base64 (the be parses it). */
export class ContractImportFileInput {
    /** The file name, with its .csv or .xlsx extension. */
    @Field(() => String)
    @IsString()
    @MaxLength(255)
    name!: string

    /** The bytes of the file as base64. */
    @Field(() => String)
    @IsString()
    @MaxLength(CONTRACT_IMPORT_FILE_BASE64_MAX)
    contentBase64!: string
}
