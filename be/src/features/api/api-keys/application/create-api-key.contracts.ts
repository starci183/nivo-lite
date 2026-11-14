import type { ApiKeyKind, ApiKeyView } from "@modules/domain/api-keys"

/** What creating an API key takes: the workspace, the name and, for an agent's MCP credential, the agent. */
export interface CreateApiKeyRequest {
    /** The workspace the key will act for; the caller must manage it. */
    readonly workspaceId: string
    /** The name of the key. */
    readonly name: string
    /** What the key is for; absent for a public API key. */
    readonly kind?: ApiKeyKind | undefined
    /** The agent of the workspace the key is scoped to; absent for an unscoped key. */
    readonly agentId?: string | undefined
}

/** What creating an API key answers: the secret, shown once, and the stored view. */
export interface CreateApiKeyResult {
    /** The secret key. */
    readonly key: string
    /** The stored view of the key. */
    readonly item: ApiKeyView
}
