import { ok, refused, type Outcome } from "@modules/platform/primitives"
import type {
    ApiKeyAuthAnswer,
    ApiKeyInactiveReason,
    ApiKeyKind,
    ApiScope,
    McpKeyFacts,
    McpKeyPrincipal,
} from "./api-keys.contracts"
import { ApiKeysErrorCode } from "./errors/api-keys.error"

/** Requests per minute per key. */
export const RATE_LIMIT_PER_MINUTE = 60

/** The most active keys one workspace may hold. */
export const ACTIVE_KEYS_MAX = 20

/** The one scope of an MCP key: the outbound MCP endpoint, as the key's holder. */
export const MCP_SCOPE = "mcp"

/** What a key with these scopes is for: an MCP key carries exactly the MCP scope. */
export const kindOfScopes = (scopes: ReadonlyArray<string> | null): ApiKeyKind =>
    (scopes ?? []).includes(MCP_SCOPE) ? "mcp" : "public_api"

/** Every key starts with this, so a leaked one is recognisable: a key reads `nvk_<id>.<secret>`. */
export const KEY_PREFIX = "nvk_"

/** The characters of a key id shown after the prefix, next to the key name. */
const DISPLAY_ID_LENGTH = 8

/** The recognisable start of a key shown next to its name: the prefix and the first characters of its id. */
export const displayPrefix = (keyId: string): string => `${KEY_PREFIX}${keyId.slice(0, DISPLAY_ID_LENGTH)}`

/** Why a key the package refused is refused here: a revoked key as such, every other reason (unknown, wrong secret, malformed, missing) as unauthorized. */
export const refusalOfVerify = (reason: unknown): ApiKeysErrorCode =>
    reason === "revoked" ? ApiKeysErrorCode.Revoked : ApiKeysErrorCode.Unauthorized

/** The shortest key name once trimmed. */
const NAME_MIN = 2

/** The longest key name. */
const NAME_MAX = 60

/** The name a manager typed, with its white space collapsed and its length bounded; refused when it is too short. */
export const cleanName = (raw: string): Outcome<string, ApiKeysErrorCode> => {
    const name = raw.trim().replaceAll(/\s+/g, " ").slice(0, NAME_MAX)
    return name.length < NAME_MIN ? refused(ApiKeysErrorCode.NameTooShort) : ok(name)
}

/** Seconds until the current minute ends. */
export const secondsToRenewal = (now: Date): number => 60 - now.getUTCSeconds()

/**
 * Refuses a key that used up its minute budget (what the rate hit of the database answered) or that was revoked since it was verified,
 * else lets it through.
 */
export const withinMinuteBudget = (answer: ApiKeyAuthAnswer | null, now: Date): Outcome<null, ApiKeysErrorCode> => {
    if (answer?.revoked) return refused(ApiKeysErrorCode.Revoked)
    return (answer?.hits ?? 0) > RATE_LIMIT_PER_MINUTE
        ? refused(ApiKeysErrorCode.RateLimited, { limit: RATE_LIMIT_PER_MINUTE, retryAfter: secondsToRenewal(now) })
        : ok(null)
}

/** Refuses a verified public API key that was not granted `scope`: the operation family a request needs. */
export const requireScope = (scopes: ReadonlyArray<string>, scope: ApiScope): Outcome<null, ApiKeysErrorCode> =>
    scopes.includes(scope) ? ok(null) : refused(ApiKeysErrorCode.ScopeMissing, { scope })

/** True when a workspace role may manage API keys. */
export const mayManageKeys = (role: string | undefined): boolean => role === "owner" || role === "manager"

/**
 * Decides what a VERIFIED (existing, not revoked) MCP key may do: it carries the MCP scope, its holder STILL is an owner or manager of
 * the key's workspace (judged at every call) and, for an agent-scoped key, the agent is active there. A public API key, a key whose
 * holder left (or whose account was deleted), a key whose holder was demoted to staff and a key scoped to a deleted or paused agent are
 * refused. The key row is kept: promoting the holder again admits it again.
 */
export const admitMcpKey = (facts: McpKeyFacts): Outcome<McpKeyPrincipal, ApiKeysErrorCode> => {
    if (kindOfScopes(facts.scopes) !== "mcp") return refused(ApiKeysErrorCode.ScopeMissing, { scope: MCP_SCOPE })
    if (facts.createdBy === null || facts.holderRole === null) return refused(ApiKeysErrorCode.HolderGone)
    if (!mayManageKeys(facts.holderRole)) return refused(ApiKeysErrorCode.HolderNotManager)
    if (facts.agentId !== null && facts.agentStatus !== "active") return refused(ApiKeysErrorCode.Unauthorized)
    return ok({
        keyId: facts.id,
        workspaceId: facts.workspaceId,
        holderId: facts.createdBy,
        agentId: facts.agentId,
    })
}

/** What the suspension of a key is judged from. */
export interface InactiveFacts {
    /** What the key is for. */
    readonly kind: ApiKeyKind
    /** True when the key was revoked. */
    readonly revoked: boolean
    /** The holder's account, or null when it was deleted. */
    readonly holderId: string | null
    /** The role of the holder's active seat in the key's workspace, or null when they hold none. */
    readonly holderRole: string | null
}

/**
 * Why a working MCP key is suspended now, or null: derived from the holder's current seat, the same facts the admission judges. A
 * revoked key is final (never suspended) and a public API key is not held by a person in that sense.
 */
export const inactiveReasonOf = (facts: InactiveFacts): ApiKeyInactiveReason | null => {
    if (facts.kind !== "mcp" || facts.revoked) return null
    if (facts.holderId === null || facts.holderRole === null) return "holder_gone"
    return mayManageKeys(facts.holderRole) ? null : "holder_not_manager"
}
