import { Test } from "@nestjs/testing"
import { ApiKeysErrorCode } from "./errors/api-keys.error"
import {
    RATE_LIMIT_PER_MINUTE,
    displayPrefix,
    refusalOfVerify,
    requireScope,
    cleanName,
    secondsToRenewal,
    withinMinuteBudget,
    admitMcpKey,
    kindOfScopes,
    mayManageKeys,
    inactiveReasonOf,
} from "./api-keys.policy"

const SUBJECT = Symbol("api-keys.policy")
type Subject = {
    displayPrefix: typeof displayPrefix
    refusalOfVerify: typeof refusalOfVerify
    requireScope: typeof requireScope
    cleanName: typeof cleanName
    secondsToRenewal: typeof secondsToRenewal
    withinMinuteBudget: typeof withinMinuteBudget
    admitMcpKey: typeof admitMcpKey
    kindOfScopes: typeof kindOfScopes
    mayManageKeys: typeof mayManageKeys
    inactiveReasonOf: typeof inactiveReasonOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    displayPrefix,
                    refusalOfVerify,
                    requireScope,
                    cleanName,
                    secondsToRenewal,
                    withinMinuteBudget,
                    admitMcpKey,
                    kindOfScopes,
                    mayManageKeys,
                    inactiveReasonOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-10-12T10:00:20.000Z")

describe("api-keys policy", () => {
    it("shows a key by its recognizable prefix and the first characters of its id", async () => {
        const subject = await buildSubject()
        expect(subject.displayPrefix("0b9d5c2e-1f3a-4b6c-8d7e-9a0b1c2d3e4f")).toBe("nvk_0b9d5c2e")
    })

    it("reads a refused key as revoked only when the verifier said so, any other reason as unauthorized", async () => {
        const subject = await buildSubject()
        expect(subject.refusalOfVerify("revoked")).toBe(ApiKeysErrorCode.Revoked)
        for (const reason of ["unknown", "secret", "malformed", "missing", "ambiguous", "expired", undefined]) {
            expect(subject.refusalOfVerify(reason)).toBe(ApiKeysErrorCode.Unauthorized)
        }
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

describe("api-keys policy secondsToRenewal", () => {
    it("counts the seconds left in the minute", async () => {
        const subject = await buildSubject()
        expect(subject.secondsToRenewal(NOW)).toBe(40)
    })
})

describe("api-keys policy withinMinuteBudget", () => {
    it("lets a key through up to its budget and refuses the next request with the time to renewal", async () => {
        const subject = await buildSubject()

        expect(subject.withinMinuteBudget({ hits: RATE_LIMIT_PER_MINUTE }, NOW)).toEqual({ kind: "ok", value: null })
        expect(subject.withinMinuteBudget(null, NOW)).toEqual({ kind: "ok", value: null })
        expect(subject.withinMinuteBudget({ revoked: true }, NOW)).toEqual({ kind: "refused", code: ApiKeysErrorCode.Revoked })
        expect(subject.withinMinuteBudget({ hits: RATE_LIMIT_PER_MINUTE + 1 }, NOW)).toEqual({
            kind: "refused",
            code: ApiKeysErrorCode.RateLimited,
            params: { limit: RATE_LIMIT_PER_MINUTE, retryAfter: 40 },
        })
    })
})

describe("api-keys policy requireScope", () => {
    it("admits a scope the key carries and refuses one it does not", async () => {
        const subject = await buildSubject()
        expect(subject.requireScope(["leads:read", "leads:write"], "leads:read")).toEqual({ kind: "ok", value: null })
        expect(subject.requireScope(["leads:read"], "events:read")).toEqual({
            kind: "refused",
            code: ApiKeysErrorCode.ScopeMissing,
            params: { scope: "events:read" },
        })
        expect(subject.requireScope([], "leads:read")).toMatchObject({ code: ApiKeysErrorCode.ScopeMissing })
    })
})

/** What the store answers for an MCP key: the key row and the state of its holder and agent. */
interface McpAnswer {
    readonly id: string
    readonly workspaceId: string
    readonly createdBy: string | null
    readonly agentId: string | null
    readonly scopes: ReadonlyArray<string> | null
    readonly holderRole: string | null
    readonly agentStatus: string | null
}

const mcpAnswer: McpAnswer = {
    id: "key-1",
    workspaceId: "workspace-1",
    createdBy: "user-1",
    agentId: null,
    scopes: ["mcp"],
    holderRole: "owner",
    agentStatus: null,
}

describe("api-keys policy admitMcpKey", () => {
    it("admits a working MCP key as its holder, unscoped or scoped to an active agent", async () => {
        const subject = await buildSubject()
        expect(subject.admitMcpKey(mcpAnswer)).toEqual({
            kind: "ok",
            value: { keyId: "key-1", workspaceId: "workspace-1", holderId: "user-1", agentId: null },
        })
        expect(subject.admitMcpKey({ ...mcpAnswer, agentId: "agent-1", agentStatus: "active" })).toMatchObject({
            kind: "ok",
            value: { holderId: "user-1", agentId: "agent-1" },
        })
    })

    it("refuses a public API key and the retired agent-bound key", async () => {
        const subject = await buildSubject()
        expect(subject.admitMcpKey({ ...mcpAnswer, scopes: ["leads:read"] })).toMatchObject({
            code: ApiKeysErrorCode.ScopeMissing,
            params: { scope: "mcp" },
        })
        expect(subject.admitMcpKey({ ...mcpAnswer, scopes: ["tools:call"] })).toMatchObject({
            code: ApiKeysErrorCode.ScopeMissing,
        })
        expect(subject.admitMcpKey({ ...mcpAnswer, scopes: null })).toMatchObject({ code: ApiKeysErrorCode.ScopeMissing })
    })

    it("refuses a key whose holder left the workspace or whose account was deleted", async () => {
        const subject = await buildSubject()
        expect(subject.admitMcpKey({ ...mcpAnswer, holderRole: null })).toMatchObject({
            code: ApiKeysErrorCode.HolderGone,
        })
        expect(subject.admitMcpKey({ ...mcpAnswer, createdBy: null })).toMatchObject({
            code: ApiKeysErrorCode.HolderGone,
        })
    })

    it("admits a key held by an owner or a manager and refuses one whose holder is staff (demoted)", async () => {
        const subject = await buildSubject()
        for (const holderRole of ["owner", "manager"]) {
            expect(subject.admitMcpKey({ ...mcpAnswer, holderRole })).toMatchObject({ kind: "ok" })
        }
        expect(subject.admitMcpKey({ ...mcpAnswer, holderRole: "staff" })).toMatchObject({
            code: ApiKeysErrorCode.HolderNotManager,
        })
        expect(
            subject.admitMcpKey({ ...mcpAnswer, holderRole: "staff", agentId: "agent-1", agentStatus: "active" }),
        ).toMatchObject({ code: ApiKeysErrorCode.HolderNotManager })
    })

    it("refuses a key scoped to a missing or paused agent", async () => {
        const subject = await buildSubject()
        for (const status of [null, "paused"]) {
            expect(subject.admitMcpKey({ ...mcpAnswer, agentId: "agent-1", agentStatus: status })).toMatchObject({
                code: ApiKeysErrorCode.Unauthorized,
            })
        }
    })
})

describe("api-keys policy key kinds and changes", () => {
    it("reads an MCP key from its one scope and any other key as a public API key", async () => {
        const subject = await buildSubject()
        expect(subject.kindOfScopes(["mcp"])).toBe("mcp")
        expect(subject.kindOfScopes(["leads:read", "events:read"])).toBe("public_api")
        expect(subject.kindOfScopes(null)).toBe("public_api")
    })
})

describe("api-keys policy inactiveReasonOf", () => {
    it("derives why a working MCP key is suspended from its holder's current role, and nothing for any other key", async () => {
        const subject = await buildSubject()
        const base = { kind: "mcp" as const, revoked: false, holderId: "user-1" }
        expect(subject.inactiveReasonOf({ ...base, holderRole: "owner" })).toBeNull()
        expect(subject.inactiveReasonOf({ ...base, holderRole: "manager" })).toBeNull()
        expect(subject.inactiveReasonOf({ ...base, holderRole: "staff" })).toBe("holder_not_manager")
        expect(subject.inactiveReasonOf({ ...base, holderRole: null })).toBe("holder_gone")
        expect(subject.inactiveReasonOf({ ...base, holderId: null, holderRole: null })).toBe("holder_gone")
        expect(subject.inactiveReasonOf({ ...base, revoked: true, holderRole: "staff" })).toBeNull()
        expect(subject.inactiveReasonOf({ ...base, kind: "public_api", holderRole: "staff" })).toBeNull()
    })
})
