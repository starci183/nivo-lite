import type { AgentTexts } from "@modules/domain/agents"
/** What set agent texts takes. */
export interface SetAgentTextsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The instructions and business notes that replace the current ones. */
    readonly texts: AgentTexts
}
