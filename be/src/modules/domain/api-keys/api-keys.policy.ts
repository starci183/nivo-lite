import { createHash } from "node:crypto"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { ApiKeyAuthAnswer, ApiPrincipal, ApiScope } from "./api-keys.contracts"
import { ApiKeysErrorCode } from "./errors/api-keys.error"

/** Requests per minute per key. */
export const RATE_LIMIT_PER_MINUTE = 60

/** Every key starts with this, so a leaked one is recognisable. */
const KEY_PREFIX = "nvk_"

/** The SHA-256 of a key: the only form in which it is stored. */
export const hashKey = (key: string): string => createHash("sha256").update(key).digest("hex")

/** The key out of an `Authorization: Bearer <key>` header, or undefined when the header names no API key. */
export const bearerKey = (authorization: string | undefined): string | undefined => {
    const key = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
    return key?.startsWith(KEY_PREFIX) ? key : undefined
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
