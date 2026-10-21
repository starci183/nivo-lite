import type { ApiKeyView } from "@modules/domain/api-keys"

/** What creating an API key takes: the workspace, the name and, for an agent's MCP credential, the agent. */
export interface CreateApiKeyRequest {
    /** The workspace the key will act for; the caller must manage it. */
    readonly workspaceId: string
    /** The name of the key. */
    readonly name: string
    /** The agent of the workspace the key acts as on the MCP endpoint; absent for a public API key. */
    readonly agentId?: string
}

/** What creating an API key answers: the secret, shown once, and the stored view. */
export interface CreateApiKeyResult {
    /** The secret key. */
    readonly key: string
    /** The stored view of the key. */
    readonly item: ApiKeyView
}
