/** The scopes a key can carry, one per operation family of the public API. */
export const API_KEY_SCOPES = [
    "leads:read",
    "leads:write",
    "messages:write",
    "knowledge:write",
    "events:read",
    "loyalty:read",
    "loyalty:write",
] as const satisfies ReadonlyArray<ApiScope>

/** One scope of a key: the operation family a request needs and the key must have been granted. */
export type ApiScope =
    | "leads:read"
    | "leads:write"
    | "messages:write"
    | "knowledge:write"
    | "events:read"
    | "loyalty:read"
    | "loyalty:write"

/** The value of an `Authorization` request header, absent when the caller sent none. */
export type BearerHeader = string | undefined

/** What a verified key stands for: it acts for exactly one workspace. */
export interface ApiPrincipal {
    /** The key id. */
    readonly keyId: string
    /** The only workspace the key acts for. */
    readonly workspaceId: string
    /** The name the owner gave the key; evidence names its source `api:<name>`. */
    readonly name: string
    /** The scopes the key carries. */
    readonly scopes: ReadonlyArray<string>
}

/** One key as the workspace manager sees it: never the key itself, which is not stored. */
export interface ApiKeyView {
    /** The key id. */
    readonly id: string
    /** The name the owner gave the key. */
    readonly name: string
    /** The first characters of the key, enough to recognise it. */
    readonly prefix: string
    /** When the key was created, ISO 8601. */
    readonly createdAt: string
    /** When the key last authenticated a request, ISO 8601, or null. */
    readonly lastUsedAt: string | null
    /** When the key was revoked, ISO 8601, or null while it works. */
    readonly revokedAt: string | null
}

/** A key just created: the secret is shown here once and never again. */
export interface CreatedApiKey {
    /** The secret key. */
    readonly key: string
    /** The stored view of the key. */
    readonly item: ApiKeyView
}

/** What the `api_key_auth` function answers for a bearer key hash; null when no key has the hash. */
export interface ApiKeyAuthAnswer {
    /** The key id (absent for a revoked key). */
    readonly id?: string
    /** The workspace of the key (absent for a revoked key). */
    readonly workspace_id?: string
    /** The key name. */
    readonly name?: string
    /** The scopes of the key. */
    readonly scopes?: ReadonlyArray<string>
    /** True when the key was revoked. */
    readonly revoked?: boolean
    /** Requests of this key in the current minute, this one included. */
    readonly hits?: number
}

/** A freshly built key: the secret, the prefix that recognises it and the hash that is stored. */
export interface BuiltKey {
    /** The secret key, shown once. */
    readonly key: string
    /** The first characters of the key. */
    readonly prefix: string
    /** The SHA-256 of the key: the only form in which it is stored. */
    readonly hash: string
}
