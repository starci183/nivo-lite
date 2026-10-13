import type { Access, Purpose } from "@modules/domain/agent-connections"
/** What grant agent connection takes. */
export interface GrantAgentConnectionRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
    /** What the agent uses it for. */
    readonly purpose: Purpose
    /** What the agent may do through it. */
    readonly access: Access
}
