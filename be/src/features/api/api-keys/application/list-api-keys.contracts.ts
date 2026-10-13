import type { ApiKeyView } from "@modules/domain/api-keys"

/** What listing the API keys takes: the workspace. */
export interface ListApiKeysRequest {
    /** The workspace whose keys to list; the caller must manage it. */
    readonly workspaceId: string
}

/** What listing the API keys answers: the keys, newest first, never the secret. */
export type ListApiKeysResult = ReadonlyArray<ApiKeyView>
