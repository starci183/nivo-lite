import { IsUUID, MaxLength } from "class-validator"

/** The path parameter that names one document. */
export class SourceIdRequest {
    /** The document. */
    @IsUUID("4")
    @MaxLength(36)
    sourceId!: string
}
