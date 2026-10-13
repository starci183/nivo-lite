import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request for an address to upload one document to. */
export class CreateUploadRequest {
    /** The name of the file that will be uploaded. */
    @IsString()
    @MaxLength(255)
    filename!: string
}
