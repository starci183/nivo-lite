/** One API key as a workspace manager sees it; never the secret. */
export class ApiKeyResponse {
    /** The key id. */
    id!: string
    /** The name of the key. */
    name!: string
    /** The first characters of the key. */
    prefix!: string
    /** When the key was created, ISO 8601. */
    createdAt!: string
    /** When the key last authenticated a request, ISO 8601, or null. */
    lastUsedAt!: string | null
    /** When the key was revoked, ISO 8601, or null while it works. */
    revokedAt!: string | null
}
