import { ApiKeysErrorCode } from "./errors/api-keys.error"
import {
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
    it("builds a recognizable URL-safe secret and the stored SHA-256 from entropy", () => {
        expect(buildKey(Uint8Array.from([251, 255, 239, 255, 255, 255, 255, 255, 255]))).toEqual({
            key: "nvk_-__v________",
            prefix: "nvk_-__v____",
            hash: "c8efd6a8de1f8c5587b3bd8ca172e9f826700f44e5c8df2b074f37d8660fd146",
        })
    })

    it("cleans, bounds and rejects short key names", () => {
        expect(cleanName("  my\n  automation  ")).toEqual({ kind: "ok", value: "my automation" })
        expect(cleanName("x".repeat(61))).toEqual({ kind: "ok", value: "x".repeat(60) })
        expect(cleanName(" a ")).toEqual({ kind: "refused", code: ApiKeysErrorCode.NameTooShort })
        expect(cleanName(" ab ")).toEqual({ kind: "ok", value: "ab" })
    })

    it.each([
        ["owner", true],
        ["manager", true],
        ["member", false],
        [undefined, false],
    ])("allows key management for role %s: %s", (role, expected) => {
        expect(mayManageKeys(role)).toBe(expected)
    })

    describe("hashKey", () => {
        it("is the SHA-256 hex of the key", () => {
            expect(hashKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
            expect(hashKey("nvk_abc")).not.toBe(hashKey("nvk_abd"))
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
})
