import { IsUUID, MaxLength } from "class-validator"

/** The path of POST /workspaces/:workspaceId/api-keys/:keyId/revoke. */
export class RevokeApiKeyRequest {
    /** The workspace of the key. */
    @IsUUID("all")
    @MaxLength(36)
    workspaceId!: string

    /** The key to revoke. */
    @IsUUID("all")
    @MaxLength(36)
    keyId!: string
}
