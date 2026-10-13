import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of sync-members. */
export class SyncMembersParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string
}
