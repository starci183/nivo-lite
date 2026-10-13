import type { ProviderKeyValues } from "@modules/domain/channel-connections"

/** What saveProviderKeys takes. */
export interface SaveProviderKeysRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The keys by name. */
    readonly values: ProviderKeyValues
}
