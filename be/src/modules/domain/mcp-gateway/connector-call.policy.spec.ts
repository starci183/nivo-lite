import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { McpError, McpErrorCode } from "@modules/integrations/mcp"
import {
    abilityDecisionOf,
    callWordsOf,
    domainNameIn,
    failureCodeOf,
    isTimeout,
    refusalOf,
    roleIn,
    usable,
    toolVisibleTo,
} from "./connector-call.policy"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayCaller, GatewayToolSpec, WorkspaceConnector } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly usable: typeof usable
    readonly toolVisibleTo: typeof toolVisibleTo
    readonly roleIn: typeof roleIn
    readonly domainNameIn: typeof domainNameIn
    readonly isTimeout: typeof isTimeout
    readonly refusalOf: typeof refusalOf
    readonly failureCodeOf: typeof failureCodeOf
    readonly abilityDecisionOf: typeof abilityDecisionOf
    readonly callWordsOf: typeof callWordsOf
}

const SUBJECT = Symbol("connector-call.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    usable,
                    toolVisibleTo,
                    roleIn,
                    domainNameIn,
                    isTimeout,
                    refusalOf,
                    failureCodeOf,
                    abilityDecisionOf,
                    callWordsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CALLER: GatewayCaller = { workspaceId: "ws-1", agentId: "a1", conversationId: null, workItemId: null }

const specOf = builder<GatewayToolSpec>({
    name: "list",
    description: "List",
    scope: "read",
    defaultMode: "auto",
    inputSchema: {},
    role: "payment.credits.list",
})

const connectorOf = builder<WorkspaceConnector>({
    manifest: { key: "sepay", name: "SePay", kind: "native", contractVersion: "sepay@1", tools: [specOf()] },
    status: "active",
    url: null,
    credentialState: "none",
    credentialSetAt: null,
    timeoutMs: 4000,
    approvedTools: null,
    approvedAt: null,
    checkedAt: null,
})

describe("usable", () => {
    it("lets a native tool run and a remote tool only when approved", async () => {
        const policy = await build()

        expect(policy.usable(connectorOf(), "list")).toBe(true)
        expect(policy.usable(connectorOf({ approvedTools: new Set(["list"]) }), "list")).toBe(true)
        expect(policy.usable(connectorOf({ approvedTools: new Set(["other"]) }), "list")).toBe(false)
    })
})

describe("toolVisibleTo", () => {
    it("hides an internal-only tool from a conversation and shows everything else", async () => {
        const policy = await build()
        const conversation = { ...CALLER, conversationId: "c1" }

        expect(policy.toolVisibleTo(conversation, specOf({ internalOnly: true }))).toBe(false)
        expect(policy.toolVisibleTo(CALLER, specOf({ internalOnly: true }))).toBe(true)
        expect(policy.toolVisibleTo(conversation, specOf())).toBe(true)
        expect(policy.toolVisibleTo(conversation, specOf({ internalOnly: false }))).toBe(true)
    })

    it("hides an internal-only tool from a customer-facing agent outside any conversation, and shows it to an internal one", async () => {
        const policy = await build()
        const facing = { ...CALLER, audience: "customer" as const }
        const staff = { ...CALLER, audience: "internal" as const }

        expect(policy.toolVisibleTo(facing, specOf({ internalOnly: true }))).toBe(false)
        expect(policy.toolVisibleTo(staff, specOf({ internalOnly: true }))).toBe(true)
        expect(policy.toolVisibleTo(facing, specOf())).toBe(true)
    })

    it("shows an internal-only tool to the workflow step of an internal agent whatever conversation its run carries, never to a customer-facing agent's step", async () => {
        const policy = await build()
        const carried = { ...CALLER, conversationId: "c1", graphStep: true as const }

        expect(policy.toolVisibleTo({ ...carried, audience: "internal" }, specOf({ internalOnly: true }))).toBe(true)
        expect(policy.toolVisibleTo(carried, specOf({ internalOnly: true }))).toBe(true)
        expect(policy.toolVisibleTo({ ...carried, audience: "customer" }, specOf({ internalOnly: true }))).toBe(false)
        expect(
            policy.toolVisibleTo(
                { ...CALLER, conversationId: "c1", audience: "internal" },
                specOf({ internalOnly: true }),
            ),
        ).toBe(false)
    })
})

describe("roleIn", () => {
    it("answers the first usable tool of an enabled connector declaring the role", async () => {
        const policy = await build()
        const remote = connectorOf({
            manifest: { ...connectorOf().manifest, key: "shop", name: "Shop", kind: "remote" },
            approvedTools: new Set(["list"]),
        })

        expect(policy.roleIn([connectorOf(), remote], "payment.credits.list")).toEqual({
            ok: true,
            tool: { role: "payment.credits.list", name: "sepay.list", connector: "sepay", connectorName: "SePay" },
        })
    })

    it("skips a disabled connector and an unapproved tool, and answers no_capability for the rest", async () => {
        const policy = await build()
        const unapproved = connectorOf({ approvedTools: new Set() })

        expect(policy.roleIn([connectorOf({ status: "disabled" }), unapproved], "payment.credits.list")).toEqual({
            ok: false,
            code: "no_capability",
            role: "payment.credits.list",
        })
        expect(policy.roleIn([connectorOf()], "invoice.list")).toMatchObject({ ok: false, code: "no_capability" })
    })
})

describe("isTimeout", () => {
    it("knows the remote client's timeout and the gateway's own, and nothing else", async () => {
        const policy = await build()

        expect(policy.isTimeout(new McpError({ code: McpErrorCode.Timeout }))).toBe(true)
        expect(policy.isTimeout(new McpGatewayError({ code: McpGatewayErrorCode.Timeout }))).toBe(true)
        expect(policy.isTimeout(new McpError({ code: McpErrorCode.Unavailable }))).toBe(false)
        expect(policy.isTimeout(new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool }))).toBe(false)
        expect(policy.isTimeout(new Error("down"))).toBe(false)
    })
})

const refused = (params: Record<string, string>) =>
    new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params })

describe("refusalOf", () => {
    it("turns a native refusal into its answer and every other failure into null", async () => {
        const policy = await build()

        expect(policy.refusalOf(refused({ reason: "not_connected" }))).toEqual({ error: "not_connected" })
        expect(policy.refusalOf(refused({}))).toEqual({ error: "refused" })
        expect(policy.refusalOf(new McpGatewayError({ code: McpGatewayErrorCode.Timeout }))).toBeNull()
        expect(policy.refusalOf(new Error("down"))).toBeNull()
    })
})

describe("failureCodeOf", () => {
    it("is the code of a domain error and internal for anything else", async () => {
        const policy = await build()

        expect(policy.failureCodeOf(new McpError({ code: McpErrorCode.Timeout }))).toBe(McpErrorCode.Timeout)
        expect(policy.failureCodeOf(new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool }))).toBe(
            McpGatewayErrorCode.UnknownTool,
        )
        expect(policy.failureCodeOf(new Error("down"))).toBe("internal")
    })
})

describe("domainNameIn", () => {
    const sender = (extra: Partial<GatewayToolSpec> = {}): GatewayToolSpec =>
        specOf({ name: "send", domain: "chat.send", ...extra })

    it("answers the full name of the first usable tool of an enabled connector declaring the domain", async () => {
        const policy = await build()
        const chat = connectorOf({
            manifest: { ...connectorOf().manifest, key: "zalo", name: "Zalo", tools: [sender()] },
        })

        expect(policy.domainNameIn([connectorOf(), chat], "chat.send")).toBe("zalo.send")
    })

    it("skips a disabled connector and an unapproved tool, and answers null for the rest", async () => {
        const policy = await build()
        const manifest = { ...connectorOf().manifest, key: "zalo", name: "Zalo", tools: [sender()] }

        expect(
            policy.domainNameIn(
                [connectorOf({ manifest, status: "disabled" }), connectorOf({ manifest, approvedTools: new Set() })],
                "chat.send",
            ),
        ).toBeNull()
        expect(policy.domainNameIn([connectorOf()], "chat.send")).toBeNull()
    })
    it("resolves a renamed NIVO door tool by its full id on a connector under the `nivo` prefix, and keeps the old id as it is", async () => {
        const policy = await build()
        const ledger = connectorOf({
            manifest: {
                ...connectorOf().manifest,
                key: "nivo-ledger",
                namespace: "nivo",
                name: "NIVO Ledger",
                tools: [specOf({ name: "ledger.entry.append", domain: "nivo.ledger.entry.append", scope: "write" })],
            },
        })
        const old = connectorOf({
            manifest: { ...connectorOf().manifest, key: "ledger", tools: [specOf({ name: "append", domain: "ledger.append" })] },
        })

        expect(policy.domainNameIn([old, ledger], "nivo.ledger.entry.append")).toBe("nivo.ledger.entry.append")
        expect(policy.domainNameIn([old, ledger], "ledger.append")).toBe("ledger.append")
    })
})

describe("abilityDecisionOf", () => {
    it("reads a refusal as off, an approval as ask, an allowed call as auto, and no provider right as null", async () => {
        const policy = await build()
        const account = { provider: "sepay", ability: "qr.create", connectionId: "conn-1" }

        expect(policy.abilityDecisionOf({ kind: "allow", ...account })).toBe("auto")
        expect(policy.abilityDecisionOf({ kind: "approval", ...account })).toBe("ask")
        expect(
            policy.abilityDecisionOf({
                kind: "refuse",
                reason: "ability_off",
                ability: "qr.create",
                providers: ["sepay"],
            }),
        ).toBe("off")
        expect(
            policy.abilityDecisionOf({
                kind: "refuse",
                reason: "no_default_account",
                ability: "qr.create",
                providers: ["sepay"],
            }),
        ).toBe("off")
        expect(policy.abilityDecisionOf(null)).toBeNull()
    })
})

describe("callWordsOf", () => {
    it("lists each argument in plain words, in the order the call gave them", async () => {
        const policy = await build()

        expect(
            policy.callWordsOf({ orderId: " DH-1 ", amountVnd: 25000, paid: false, note: null, items: [{ sku: "A" }] }),
        ).toEqual([
            { name: "orderId", value: "DH-1" },
            { name: "amountVnd", value: "25000" },
            { name: "paid", value: "false" },
            { name: "note", value: "-" },
            { name: "items", value: '[{"sku":"A"}]' },
        ])
    })

    it("shows nothing for arguments that are no object, skips absent members and keeps at most the bound", async () => {
        const policy = await build()
        const many = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`a${String(index)}`, index]))

        expect(policy.callWordsOf(null)).toEqual([])
        expect(policy.callWordsOf(["x"])).toEqual([])
        expect(policy.callWordsOf("text")).toEqual([])
        expect(policy.callWordsOf({ kept: 1, gone: undefined })).toEqual([{ name: "kept", value: "1" }])
        expect(policy.callWordsOf(many)).toHaveLength(12)
        expect(policy.callWordsOf(many, 2)).toEqual([
            { name: "a0", value: "0" },
            { name: "a1", value: "1" },
        ])
    })

    it("cuts a long value and marks the cut", async () => {
        const policy = await build()
        const [word] = policy.callWordsOf({ text: "x".repeat(1000) })

        expect(word?.value).toHaveLength(300)
        expect(word?.value.endsWith("…")).toBe(true)
    })
})
