import { Test } from "@nestjs/testing"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import {
    RATE_LIMIT_PER_MINUTE,
    hashKey,
    buildKey,
    bearerKey,
    cleanName,
    secondsToRenewal,
    admitKey,
    admitAgentKey,
    mayManageKeys,
} from "./api-keys.policy"

const SUBJECT = Symbol("api-keys.policy")
type Subject = {
    hashKey: typeof hashKey
    buildKey: typeof buildKey
    bearerKey: typeof bearerKey
    cleanName: typeof cleanName
    secondsToRenewal: typeof secondsToRenewal
    admitKey: typeof admitKey
    admitAgentKey: typeof admitAgentKey
    mayManageKeys: typeof mayManageKeys
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    hashKey,
                    buildKey,
                    bearerKey,
                    cleanName,
                    secondsToRenewal,
                    admitKey,
                    admitAgentKey,
                    mayManageKeys,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
    it("builds a recognizable URL-safe secret and the stored SHA-256 from entropy", async () => {
        const subject = await buildSubject()
        expect(subject.buildKey(Uint8Array.from([251, 255, 239, 255, 255, 255, 255, 255, 255]))).toEqual({
            key: "nvk_-__v________",
            prefix: "nvk_-__v____",
            hash: "c8efd6a8de1f8c5587b3bd8ca172e9f826700f44e5c8df2b074f37d8660fd146",
        })
    })

    it("cleans, bounds and rejects short key names", async () => {
        const subject = await buildSubject()
        expect(subject.cleanName("  my\n  automation  ")).toEqual({ kind: "ok", value: "my automation" })
        expect(subject.cleanName("x".repeat(61))).toEqual({ kind: "ok", value: "x".repeat(60) })
        expect(subject.cleanName(" a ")).toEqual({ kind: "refused", code: ApiKeysErrorCode.NameTooShort })
        expect(subject.cleanName(" ab ")).toEqual({ kind: "ok", value: "ab" })
    })

    it.each([
        ["owner", true],
        ["manager", true],
        ["member", false],
        [undefined, false],
    ])("allows key management for role %s: %s", async (role, expected) => {
        const subject = await buildSubject()
        expect(subject.mayManageKeys(role)).toBe(expected)
    })
})

describe("api-keys policy hashKey", () => {
    it("is the SHA-256 hex of the key", async () => {
        const subject = await buildSubject()
        expect(subject.hashKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        expect(subject.hashKey("nvk_abc")).not.toBe(subject.hashKey("nvk_abd"))
    })
})

describe("api-keys policy bearerKey", () => {
    it("reads the key of a Bearer header, whatever the case of the scheme", async () => {
        const subject = await buildSubject()
        expect(subject.bearerKey("Bearer nvk_abc")).toBe("nvk_abc")
        expect(subject.bearerKey("bearer   nvk_abc")).toBe("nvk_abc")
    })

    it("reads nothing from a missing header, another scheme, a foreign key or extra words", async () => {
        const subject = await buildSubject()
        expect(subject.bearerKey(undefined)).toBeUndefined()
        expect(subject.bearerKey("Basic nvk_abc")).toBeUndefined()
        expect(subject.bearerKey("Bearer eyJhbGciOi")).toBeUndefined()
        expect(subject.bearerKey("Bearer nvk_abc extra")).toBeUndefined()
    })
})

describe("api-keys policy secondsToRenewal", () => {
    it("counts the seconds left in the minute", async () => {
        const subject = await buildSubject()
        expect(subject.secondsToRenewal(NOW)).toBe(40)
    })
})

describe("api-keys policy admitKey", () => {
    it("admits a working key that carries the scope", async () => {
        const subject = await buildSubject()
        expect(subject.admitKey(answer(), "leads:read", NOW)).toEqual({
            kind: "ok",
            value: {
                keyId: "key-1",
                workspaceId: "workspace-1",
                name: "n8n",
                scopes: ["leads:read", "leads:write"],
            },
        })
    })

    it("admits a key at its budget and refuses the next request", async () => {
        const subject = await buildSubject()
        expect(subject.admitKey(answer({ hits: RATE_LIMIT_PER_MINUTE }), "leads:read", NOW).kind).toBe("ok")
        expect(subject.admitKey(answer({ hits: RATE_LIMIT_PER_MINUTE + 1 }), "leads:read", NOW)).toEqual({
            kind: "refused",
            code: ApiKeysErrorCode.RateLimited,
            params: { limit: RATE_LIMIT_PER_MINUTE, retryAfter: 40 },
        })
    })

    it("refuses an unknown key and an answer without a workspace", async () => {
        const subject = await buildSubject()
        expect(subject.admitKey(null, "leads:read", NOW)).toMatchObject({ code: ApiKeysErrorCode.Unauthorized })
        expect(subject.admitKey(answer({ id: undefined }), "leads:read", NOW)).toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(subject.admitKey(answer({ workspace_id: undefined }), "leads:read", NOW)).toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
    })

    it("refuses a revoked key", async () => {
        const subject = await buildSubject()
        expect(subject.admitKey({ revoked: true }, "leads:read", NOW)).toMatchObject({ code: ApiKeysErrorCode.Revoked })
    })

    it("refuses a scope the key does not carry", async () => {
        const subject = await buildSubject()
        expect(subject.admitKey(answer(), "events:read", NOW)).toEqual({
            kind: "refused",
            code: ApiKeysErrorCode.ScopeMissing,
            params: { scope: "events:read" },
        })
    })

    it("reads a key without hits, scopes or name as an empty one", async () => {
        const subject = await buildSubject()
        expect(subject.admitKey({ id: "key-1", workspace_id: "workspace-1" }, "leads:read", NOW)).toMatchObject({
            code: ApiKeysErrorCode.ScopeMissing,
        })
        expect(
            subject.admitKey({ id: "key-1", workspace_id: "workspace-1", scopes: ["leads:read"] }, "leads:read", NOW),
        ).toMatchObject({ kind: "ok", value: { name: "" } })
    })
})

const agentAnswer = {
    id: "key-1",
    workspace_id: "workspace-1",
    agent_id: "agent-1",
    scopes: ["tools:call"],
    revoked: false,
    agent_status: "active",
}

describe("api-keys policy admitAgentKey", () => {
    it("admits a working key of an active agent that carries tools:call", async () => {
        const subject = await buildSubject()
        expect(subject.admitAgentKey(agentAnswer)).toEqual({
            kind: "ok",
            value: { keyId: "key-1", workspaceId: "workspace-1", agentId: "agent-1" },
        })
    })

    it("refuses an unknown key, a revoked key, a public key and the key of a missing or paused agent", async () => {
        const subject = await buildSubject()
        expect(subject.admitAgentKey(undefined)).toMatchObject({ code: ApiKeysErrorCode.Unauthorized })
        expect(subject.admitAgentKey({ ...agentAnswer, revoked: true })).toMatchObject({
            code: ApiKeysErrorCode.Revoked,
        })
        expect(subject.admitAgentKey({ ...agentAnswer, agent_id: null })).toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(subject.admitAgentKey({ ...agentAnswer, agent_status: null })).toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
        expect(subject.admitAgentKey({ ...agentAnswer, agent_status: "paused" })).toMatchObject({
            code: ApiKeysErrorCode.Unauthorized,
        })
    })

    it("refuses a key without the tools:call scope", async () => {
        const subject = await buildSubject()
        expect(subject.admitAgentKey({ ...agentAnswer, scopes: null })).toMatchObject({
            code: ApiKeysErrorCode.ScopeMissing,
            params: { scope: "tools:call" },
        })
    })
})
