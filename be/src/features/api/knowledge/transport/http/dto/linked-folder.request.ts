import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that lists a pasted Google Drive folder link. */
export class LinkedFolderRequest {
    /** The pasted folder link. */
    @IsString()
    @MaxLength(2000)
    url!: string
}
