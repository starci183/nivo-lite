import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import {
    callWordsOf,
    domainNameIn,
    failureCodeOf,
    isTimeout,
    businessRefusalOf,
    refusalOf,
    roleIn,
    toolVisibleTo,
} from "./tool-call.policy"
import { toolArgumentsSchema } from "./tool-arguments.schema"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import type { ToolCaller, ManifestTool, WorkspaceToolFamily } from "./tools.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly toolVisibleTo: typeof toolVisibleTo
    readonly roleIn: typeof roleIn
    readonly domainNameIn: typeof domainNameIn
    readonly isTimeout: typeof isTimeout
    readonly refusalOf: typeof refusalOf
    readonly failureCodeOf: typeof failureCodeOf
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
                    toolVisibleTo,
                    roleIn,
                    domainNameIn,
                    isTimeout,
                    refusalOf,
                    failureCodeOf,
                    callWordsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CALLER: ToolCaller = { workspaceId: "ws-1", agentId: "a1", conversationId: null, workItemId: null }

const specOf = builder<ManifestTool>({
    name: "list",
    description: "List",
    scope: "read",
    defaultMode: "auto",
    inputSchema: {},
    argumentSchema: toolArgumentsSchema,
    role: "payment.credits.list",
})

const connectorOf = builder<WorkspaceToolFamily>({
    manifest: { key: "sepay", name: "SePay", contractVersion: "sepay@1", tools: [specOf()] },
    timeoutMs: 4000,
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
    it("answers the first tool of the families declaring the role", async () => {
        const policy = await build()
        const shop = connectorOf({ manifest: { ...connectorOf().manifest, key: "shop", name: "Shop" } })

        expect(policy.roleIn([connectorOf(), shop], "payment.credits.list")).toEqual({
            ok: true,
            tool: { role: "payment.credits.list", name: "sepay.list", connector: "sepay", connectorName: "SePay" },
        })
    })

    it("answers no_capability when no family declares the role", async () => {
        const policy = await build()

        expect(policy.roleIn([connectorOf()], "invoice.list")).toMatchObject({ ok: false, code: "no_capability" })
    })
})

describe("isTimeout", () => {
    it("knows the registry's own timeout, and nothing else", async () => {
        const policy = await build()

        expect(policy.isTimeout(new ToolsError({ code: ToolsErrorCode.Timeout }))).toBe(true)
        expect(policy.isTimeout(new ToolsError({ code: ToolsErrorCode.UnknownTool }))).toBe(false)
        expect(policy.isTimeout(new Error("down"))).toBe(false)
    })
})

const refused = (params: Record<string, string>) =>
    new ToolsError({ code: ToolsErrorCode.NativeRefused, params })

describe("refusalOf", () => {
    it("turns a native refusal into its answer and every other failure into null", async () => {
        const policy = await build()

        expect(policy.refusalOf(refused({ reason: "not_connected" }))).toEqual({ error: "not_connected" })
        expect(policy.refusalOf(refused({}))).toEqual({ error: "refused" })
        expect(policy.refusalOf(new ToolsError({ code: ToolsErrorCode.Timeout }))).toBeNull()
        expect(policy.refusalOf(new Error("down"))).toBeNull()
    })
})

describe("businessRefusalOf", () => {
    it("names the reason of a native refusal its source classed business; null for any other class, none, or another failure", () => {
        expect(businessRefusalOf(refused({ reason: "other_lead", refusalClass: "business" }))).toBe("other_lead")
        expect(businessRefusalOf(refused({ reason: "not_connected", refusalClass: "infrastructure" }))).toBeNull()
        expect(businessRefusalOf(refused({ reason: "no_room" }))).toBeNull()
        expect(businessRefusalOf(new ToolsError({ code: ToolsErrorCode.Timeout }))).toBeNull()
    })
})

describe("failureCodeOf", () => {
    it("is the code of a domain error and internal for anything else", async () => {
        const policy = await build()

        expect(policy.failureCodeOf(new ToolsError({ code: ToolsErrorCode.UnknownTool }))).toBe(
            ToolsErrorCode.UnknownTool,
        )
        expect(policy.failureCodeOf(new Error("down"))).toBe("internal")
    })
})

describe("domainNameIn", () => {
    const sender = (extra: Partial<ManifestTool> = {}): ManifestTool =>
        specOf({ name: "send", domain: "nivo.tool.customer.message.send", ...extra })

    it("answers the full name of the first tool of the families declaring the domain", async () => {
        const policy = await build()
        const chat = connectorOf({
            manifest: { ...connectorOf().manifest, key: "zalo", name: "Zalo", tools: [sender()] },
        })

        expect(policy.domainNameIn([connectorOf(), chat], "nivo.tool.customer.message.send")).toBe("zalo.send")
    })

    it("answers null when no family declares the domain", async () => {
        const policy = await build()

        expect(policy.domainNameIn([connectorOf()], "nivo.tool.customer.message.send")).toBeNull()
    })
    it("resolves a NIVO door tool by its full id through the connector's public prefix, and an old id to nothing", async () => {
        const policy = await build()
        const ledger = connectorOf({
            manifest: {
                ...connectorOf().manifest,
                key: "ledger",
                namespace: "nivo.tool.ledger",
                name: "Ledger",
                tools: [specOf({ name: "entry.append", domain: "nivo.tool.ledger.entry.append", scope: "write" })],
            },
        })

        expect(policy.domainNameIn([ledger], "nivo.tool.ledger.entry.append")).toBe("nivo.tool.ledger.entry.append")
        // no alias: the name before the flip resolves to nothing
        expect(policy.domainNameIn([ledger], ["ledger", "append"].join("."))).toBeNull()
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
