import { IsString, MaxLength } from "class-validator"

/** The body of POST /workspaces/:workspaceId/api-keys. */
export class CreateApiKeyRequest {
    /** The name of the key. */
    @IsString()
    @MaxLength(200)
    name!: string
}
