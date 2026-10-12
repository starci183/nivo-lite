import { IsUUID, MaxLength } from "class-validator"

/** The path of GET /workspaces/:workspaceId/api-keys. */
export class ListApiKeysRequest {
    /** The workspace whose keys to list. */
    @IsUUID("all")
    @MaxLength(36)
    workspaceId!: string
}
