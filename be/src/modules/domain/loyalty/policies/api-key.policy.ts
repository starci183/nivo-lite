import { createHash } from "node:crypto"

/** The requests per minute one API key may make. */
export const API_KEY_RATE_LIMIT = 60

const KEY_PREFIX = "nvk_"
const BEARER = /^Bearer\s+(\S+)$/iu

/** What the database answers for a key hash. */
export interface ApiKeyAuth {
    /** The key id. */
    readonly id: string
    /** The workspace the key acts for. */
    readonly workspace_id: string
    /** The name of the key. */
    readonly name: string
    /** The scopes the key carries. */
    readonly scopes: ReadonlyArray<string>
    /** Whether the key was revoked. */
    readonly revoked: boolean
    /** The requests the key made in the current minute, this one included. */
    readonly hits: number
}

/** Whether a call may go ahead and, if not, why. */
export type KeyVerdict = "ok" | "invalid" | "revoked" | "rate_limited" | "scope_missing"

/** The key of an `Authorization: Bearer` header, or an empty text when the header carries none. */
export const bearerKey = (header: string): string => BEARER.exec(header)?.[1] ?? ""

/** The SHA-256 of a key, the only form the database stores. */
export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex")

/** Judges a key against what the database answered for its hash. */
export const verdictOf = (key: string, auth: ApiKeyAuth | null, scope: string): KeyVerdict => {
    if (!key.startsWith(KEY_PREFIX) || auth === null) return "invalid"
    if (auth.revoked) return "revoked"
    if (auth.hits > API_KEY_RATE_LIMIT) return "rate_limited"
    return auth.scopes.includes(scope) ? "ok" : "scope_missing"
}
