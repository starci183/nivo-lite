import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { McpError, McpErrorCode } from "@modules/integrations/mcp"
import { failureCodeOf, isTimeout, refusalOf, roleIn, usable, visibleTo } from "./connector-call.policy"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayCaller, GatewayToolSpec, WorkspaceConnector } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly usable: typeof usable
    readonly visibleTo: typeof visibleTo
    readonly roleIn: typeof roleIn
    readonly isTimeout: typeof isTimeout
    readonly refusalOf: typeof refusalOf
    readonly failureCodeOf: typeof failureCodeOf
}

const SUBJECT = Symbol("connector-call.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { usable, visibleTo, roleIn, isTimeout, refusalOf, failureCodeOf },
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

describe("visibleTo", () => {
    it("hides an internal-only tool from a conversation and shows everything else", async () => {
        const policy = await build()
        const conversation = { ...CALLER, conversationId: "c1" }

        expect(policy.visibleTo(conversation, specOf({ internalOnly: true }))).toBe(false)
        expect(policy.visibleTo(CALLER, specOf({ internalOnly: true }))).toBe(true)
        expect(policy.visibleTo(conversation, specOf())).toBe(true)
        expect(policy.visibleTo(conversation, specOf({ internalOnly: false }))).toBe(true)
    })

    it("hides an internal-only tool from a customer-facing agent outside any conversation, and shows it to an internal one", async () => {
        const policy = await build()
        const facing = { ...CALLER, audience: "customer" as const }
        const staff = { ...CALLER, audience: "internal" as const }

        expect(policy.visibleTo(facing, specOf({ internalOnly: true }))).toBe(false)
        expect(policy.visibleTo(staff, specOf({ internalOnly: true }))).toBe(true)
        expect(policy.visibleTo(facing, specOf())).toBe(true)
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
