import type { Access } from "@modules/domain/connection-grants"

/** What set grant takes. */
export interface SetGrantRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The agent. */
    readonly agentId: string
    /** The level to give, or null to remove the access. */
    readonly access: Access | null
}

/** What set grant answers: nothing. */
export type SetGrantResult = void
