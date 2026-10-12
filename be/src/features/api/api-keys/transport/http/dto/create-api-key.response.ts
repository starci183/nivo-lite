import type { ApiKeyResponse } from "./api-key.response"

/** The HTTP response of creating an API key: the secret is shown here once. */
export class CreateApiKeyResponse {
    /** The secret key; it cannot be read again. */
    key!: string
    /** The stored view of the key. */
    item!: ApiKeyResponse
}
