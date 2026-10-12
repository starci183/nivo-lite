import { ApiKeysErrorCode } from "./errors/api-keys.error"
import {
    KEY_PREFIX,
    RATE_LIMIT_PER_MINUTE,
    admitKey,
    bearerKey,
    buildKey,
    cleanName,
    hashKey,
    mayManageKeys,
    secondsToRenewal,
} from "./api-keys.policy"

const NOW = new Date("2026-10-12T10:00:20.000Z")

const answer = (overrides: Record<string, unknown> = {}) => ({
    id: "key-1",
    workspace_id: "workspace-1",
    name: "n8n",
    scopes: ["leads:read", "leads:write"],
    hits: 1,
    ...overrides,
})

describe("api-keys policy", () => {
    describe("hashKey", () => {
        it("is the SHA-256 hex of the key", () => {
            expect(hashKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
            expect(hashKey("nvk_abc")).not.toBe(hashKey("nvk_abd"))
        })
    })

    describe("buildKey", () => {
        it("makes an nvk key from the entropy with its 12 character prefix and its hash", () => {
            const built = buildKey(new Uint8Array(32).fill(7))

            expect(built.key.startsWith(KEY_PREFIX)).toBe(true)
            expect(built.key).toHaveLength(KEY_PREFIX.length + 43)
            expect(built.prefix).toBe(built.key.slice(0, 12))
            expect(built.hash).toBe(hashKey(built.key))
        })

        it("makes a different key from different entropy", () => {
            expect(buildKey(new Uint8Array(32).fill(1)).key).not.toBe(buildKey(new Uint8Array(32).fill(2)).key)
        })
    })

    describe("bearerKey", () => {
        it("reads the key of a Bearer header, whatever the case of the scheme", () => {
            expect(bearerKey("Bearer nvk_abc")).toBe("nvk_abc")
            expect(bearerKey("bearer   nvk_abc")).toBe("nvk_abc")
        })

        it("reads nothing from a missing header, another scheme, a foreign key or extra words", () => {
            expect(bearerKey(undefined)).toBeUndefined()
            expect(bearerKey("Basic nvk_abc")).toBeUndefined()
            expect(bearerKey("Bearer eyJhbGciOi")).toBeUndefined()
            expect(bearerKey("Bearer nvk_abc extra")).toBeUndefined()
        })
    })

    describe("cleanName", () => {
        it("collapses white space and bounds the length", () => {
            expect(cleanName("  n8n   ban hang ")).toEqual({ kind: "ok", value: "n8n ban hang" })
            const long = cleanName("x".repeat(100))
            expect(long.kind === "ok" && long.value.length).toBe(60)
        })

        it("refuses a name shorter than two characters", () => {
            expect(cleanName("  a ")).toMatchObject({ kind: "refused", code: ApiKeysErrorCode.NameTooShort })
            expect(cleanName("")).toMatchObject({ kind: "refused", code: ApiKeysErrorCode.NameTooShort })
        })
    })

    describe("secondsToRenewal", () => {
        it("counts the seconds left in the minute", () => {
            expect(secondsToRenewal(NOW)).toBe(40)
        })
    })

    describe("admitKey", () => {
        it("admits a working key that carries the scope", () => {
            expect(admitKey(answer(), "leads:read", NOW)).toEqual({
                kind: "ok",
                value: {
                    keyId: "key-1",
                    workspaceId: "workspace-1",
                    name: "n8n",
                    scopes: ["leads:read", "leads:write"],
                },
            })
        })

        it("admits a key at its budget and refuses the next request", () => {
            expect(admitKey(answer({ hits: RATE_LIMIT_PER_MINUTE }), "leads:read", NOW).kind).toBe("ok")
            expect(admitKey(answer({ hits: RATE_LIMIT_PER_MINUTE + 1 }), "leads:read", NOW)).toEqual({
                kind: "refused",
                code: ApiKeysErrorCode.RateLimited,
                params: { limit: RATE_LIMIT_PER_MINUTE, retryAfter: 40 },
            })
        })

        it("refuses an unknown key and an answer without a workspace", () => {
            expect(admitKey(null, "leads:read", NOW)).toMatchObject({ code: ApiKeysErrorCode.Unauthorized })
            expect(admitKey(answer({ id: undefined }), "leads:read", NOW)).toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
            expect(admitKey(answer({ workspace_id: undefined }), "leads:read", NOW)).toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        })

        it("refuses a revoked key", () => {
            expect(admitKey({ revoked: true }, "leads:read", NOW)).toMatchObject({ code: ApiKeysErrorCode.Revoked })
        })

        it("refuses a scope the key does not carry", () => {
            expect(admitKey(answer(), "events:read", NOW)).toEqual({
                kind: "refused",
                code: ApiKeysErrorCode.ScopeMissing,
                params: { scope: "events:read" },
            })
        })

        it("reads a key without hits, scopes or name as an empty one", () => {
            expect(admitKey({ id: "key-1", workspace_id: "workspace-1" }, "leads:read", NOW)).toMatchObject({
                code: ApiKeysErrorCode.ScopeMissing,
            })
            expect(
                admitKey({ id: "key-1", workspace_id: "workspace-1", scopes: ["leads:read"] }, "leads:read", NOW),
            ).toMatchObject({ kind: "ok", value: { name: "" } })
        })
    })

    describe("mayManageKeys", () => {
        it("lets an owner and a manager manage keys and nobody else", () => {
            expect(mayManageKeys("owner")).toBe(true)
            expect(mayManageKeys("manager")).toBe(true)
            expect(mayManageKeys("staff")).toBe(false)
            expect(mayManageKeys(undefined)).toBe(false)
        })
    })
})
