import type { ApiKeyView } from "@modules/domain/api-keys"

/** What creating an API key takes: the workspace and the name. */
export interface CreateApiKeyRequest {
    /** The workspace the key will act for; the caller must manage it. */
    readonly workspaceId: string
    /** The name of the key. */
    readonly name: string
}

/** What creating an API key answers: the secret, shown once, and the stored view. */
export interface CreateApiKeyResult {
    /** The secret key. */
    readonly key: string
    /** The stored view of the key. */
    readonly item: ApiKeyView
}
