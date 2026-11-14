/** The scopes a key can carry, one per operation family of the public API. */
export const API_KEY_SCOPES: readonly [
    "leads:read",
    "leads:write",
    "messages:write",
    "knowledge:write",
    "events:read",
] = [
    "leads:read",
    "leads:write",
    "messages:write",
    "knowledge:write",
    "events:read",
] as const satisfies ReadonlyArray<ApiScope>

/** One scope of a key: the operation family a request needs and the key must have been granted. */
export type ApiScope =
    | "leads:read"
    | "leads:write"
    | "messages:write"
    | "knowledge:write"
    | "events:read"

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

/**
 * What a key is for: `mcp` (the outbound MCP endpoint; it runs AS its holder, the member who created it, with that member's role
 * rights, optionally scoped to one agent, which only narrows the agents and workflows it sees) or `public_api` (the public REST API scopes).
 */
export type ApiKeyKind = "mcp" | "public_api"

/**
 * Why a working MCP key is suspended, derived from its holder's current seat at read time (nothing is stored): the holder is no longer
 * an owner or manager (`holder_not_manager`), or left the workspace or deleted their account (`holder_gone`). Promoting the holder again
 * lifts it with no action; a revoked key is final and is never suspended.
 */
export type ApiKeyInactiveReason = "holder_not_manager" | "holder_gone"

/** One key as a member sees it: never the key itself, which is not stored. */
export interface ApiKeyView {
    /** The key id. */
    readonly id: string
    /** The name the holder gave the key. */
    readonly name: string
    /** The first characters of the key, enough to recognise it. */
    readonly prefix: string
    /** What the key is for. */
    readonly kind: ApiKeyKind
    /** The account of the member the key runs as (its creator), or null when that account was deleted (the key then fails). */
    readonly holderId: string | null
    /** The seat name of the holder, or null when the holder holds no active seat of the workspace any more. */
    readonly holderName: string | null
    /** When the key was created, ISO 8601. */
    readonly createdAt: string
    /** When the key last authenticated a request, ISO 8601, or null. */
    readonly lastUsedAt: string | null
    /** When the key was revoked, ISO 8601, or null while it works. */
    readonly revokedAt: string | null
    /** Why the key is suspended now (an MCP key whose holder is no longer an owner or manager), or null while it works or after revocation. */
    readonly inactiveReason: ApiKeyInactiveReason | null
    /** The agent the key is scoped to (an MCP key: it sees only this agent and its workflows; a public API key: it owns the conversations the key opens), or null. */
    readonly agentId: string | null
    /** The MCP endpoint an MCP key is used at (`<MCP_PUBLIC_URL>/mcp`), or null for a public API key or with no published route. */
    readonly endpointUrl: string | null
}

/** What a verified MCP key stands for: its holder in exactly one workspace, optionally scoped to one agent. */
export interface McpKeyPrincipal {
    /** The key id. */
    readonly keyId: string
    /** The only workspace the key acts for. */
    readonly workspaceId: string
    /** The account of the member the key runs as. */
    readonly holderId: string
    /** The agent the key is scoped to, or null for an unscoped key. */
    readonly agentId: string | null
}

/** The facts the admission of a VERIFIED MCP key judges: its row's scope and the holder's and the agent's current state. */
export interface McpKeyFacts {
    /** The key id. */
    readonly id: string
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The holder's account, or null when it was deleted. */
    readonly createdBy: string | null
    /** The agent the key is scoped to, or null. */
    readonly agentId: string | null
    /** The scopes of the key. */
    readonly scopes: ReadonlyArray<string> | null
    /** The role of the holder's active seat in the key's workspace, or null when the holder holds none (left, or no account). */
    readonly holderRole: string | null
    /** The status of the scoped agent in the key's workspace, or null (no scope, or no such agent). */
    readonly agentStatus: string | null
}

/**
 * What the app's key table holds about a key besides the package's own fields (id, secret hash, revoked): handed to the verifier's store
 * port and back untouched in the verified principal. `keyHash` is the SHA-256 of the key's SECRET, the hash the minute budget is counted on.
 */
export interface ApiKeyScope {
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The name the owner gave the key. */
    readonly name: string
    /** The scopes of the key. */
    readonly scopes: ReadonlyArray<string>
    /** The holder's account, or null when it was deleted. */
    readonly createdBy: string | null
    /** The agent the key is scoped to, or null. */
    readonly agentId: string | null
    /** The SHA-256 of the key's secret as the table stores it. */
    readonly keyHash: string
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
