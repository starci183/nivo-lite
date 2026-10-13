import { IsBoolean, IsOptional, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request that rebuilds the OpenClaw copy of the agents. */
export class RequestAgentSyncRequest {
    /** The one instance to sync; the whole workspace when absent. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string

    /** Also sync an instance that is not on OpenClaw yet. */
    @IsOptional()
    @IsBoolean()
    force?: boolean
}
