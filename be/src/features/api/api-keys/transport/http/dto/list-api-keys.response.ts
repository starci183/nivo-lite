import type { ApiKeyResponse } from "./api-key.response"

/** The HTTP response of listing the API keys of a workspace. */
export class ListApiKeysResponse {
    /** The keys, newest first. */
    items!: Array<ApiKeyResponse>
}
