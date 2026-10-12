import { createHash } from "node:crypto"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { ApiKeyAuthAnswer, ApiPrincipal, ApiScope } from "./api-keys.contracts"
import { ApiKeysErrorCode } from "./errors/api-keys.error"

/** Requests per minute per key. */
export const RATE_LIMIT_PER_MINUTE = 60

/** The most active keys one workspace may hold. */
export const ACTIVE_KEYS_MAX = 20

/** Every key starts with this, so a leaked one is recognisable. */
export const KEY_PREFIX = "nvk_"

/** The characters of the key shown next to its name. */
const PREFIX_LENGTH = 12

/** The shortest key name once trimmed. */
const NAME_MIN = 2

/** The longest key name. */
const NAME_MAX = 60

/** The SHA-256 of a key: the only form in which it is stored. */
export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex")

/** A new key built from 32 bytes of entropy: the secret, the prefix that recognises it and the hash that is stored. */
export const buildKey = (entropy: Uint8Array): { key: string; prefix: string; hash: string } => {
    const key = `${KEY_PREFIX}${Buffer.from(entropy).toString("base64url")}`
    return { key, prefix: key.slice(0, PREFIX_LENGTH), hash: hashKey(key) }
}

/** The key out of an `Authorization: Bearer <key>` header, or undefined when the header names no API key. */
export const bearerKey = (authorization: string | undefined): string | undefined => {
    const key = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
    return key?.startsWith(KEY_PREFIX) ? key : undefined
}

/** The name a manager typed, with its white space collapsed and its length bounded; refused when it is too short. */
export const cleanName = (raw: string): Outcome<string, ApiKeysErrorCode> => {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, NAME_MAX)
    return name.length < NAME_MIN ? refused(ApiKeysErrorCode.NameTooShort) : ok(name)
}

/** Seconds until the current minute ends. */
export const secondsToRenewal = (now: Date): number => 60 - now.getUTCSeconds()

/** Decides what the database answered for a bearer key: the principal when the key works and carries the scope, a refusal otherwise. */
export const admitKey = (
    answer: ApiKeyAuthAnswer | null,
    scope: ApiScope,
    now: Date,
): Outcome<ApiPrincipal, ApiKeysErrorCode> => {
    if (answer?.revoked) return refused(ApiKeysErrorCode.Revoked)
    if (!answer?.id || !answer.workspace_id) return refused(ApiKeysErrorCode.Unauthorized)
    if ((answer.hits ?? 0) > RATE_LIMIT_PER_MINUTE) {
        return refused(ApiKeysErrorCode.RateLimited, {
            limit: RATE_LIMIT_PER_MINUTE,
            retryAfter: secondsToRenewal(now),
        })
    }
    const scopes = answer.scopes ?? []
    if (!scopes.includes(scope)) return refused(ApiKeysErrorCode.ScopeMissing, { scope })
    return ok({ keyId: answer.id, workspaceId: answer.workspace_id, name: answer.name ?? "", scopes })
}

/** True when a workspace role may manage API keys. */
export const mayManageKeys = (role: string | undefined): boolean => role === "owner" || role === "manager"
