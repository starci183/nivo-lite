import type { ProviderKeysResult } from "@modules/domain/channel-connections"

/** What the SaveProviderKeys operation takes. */
export interface SaveProviderKeysRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
    /** The values sent by the caller. */
    readonly values: Record<string, string>
}

/** What the SaveProviderKeys operation answers. */
export type SaveProviderKeysResult = ProviderKeysResult
