import { IsString, IsUUID, MaxLength } from "class-validator"

/** The path of the endpoint: the workspace whose gateway answers. */
export class McpEndpointPathRequest {
    /** The workspace. */
    @IsString()
    @MaxLength(36)
    @IsUUID()
    workspaceId!: string
}
