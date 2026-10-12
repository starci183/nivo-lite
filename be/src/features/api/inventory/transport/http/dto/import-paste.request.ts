import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request of import items from a pasted table. */
export class ImportPasteRequest {
    /** The pasted rows of a sheet or CSV. */
    @IsString()
    @MaxLength(200000)
    raw!: string
}
