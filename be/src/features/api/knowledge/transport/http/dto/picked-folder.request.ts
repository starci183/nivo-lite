import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that lists a folder picked in the Google Picker. */
export class PickedFolderRequest {
    /** The Drive id of the picked folder. */
    @IsString()
    @MaxLength(200)
    folderId!: string

    /** The short-lived access token of the browser; it is used for this call only. */
    @IsString()
    @MaxLength(4096)
    token!: string
}
