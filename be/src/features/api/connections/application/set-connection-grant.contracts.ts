import type { Access } from "@modules/domain/agent-connections"

/** What setConnectionGrant takes. */
export interface SetConnectionGrantRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The agent. */
    readonly agentId: string
    /** The level, or nothing to remove the access. */
    readonly access: Access | null
}
