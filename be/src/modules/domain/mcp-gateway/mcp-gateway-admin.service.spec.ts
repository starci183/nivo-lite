import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import type { McpConnectorRow } from "@modules/domain/mcp-connectors"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { MCP_REMOTE } from "@modules/integrations/mcp"
import type { McpRemote } from "@modules/integrations/mcp"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { argsHashOf } from "./audit-mask.policy"
import { McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GrantInput, RemoteConnectorInput } from "./mcp-gateway.contracts"
import { MCP_GATEWAY_OPTIONS } from "./mcp-gateway.decorators"
import { McpGatewayAdminService } from "./mcp-gateway-admin.service"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import { McpGatewayService } from "./mcp-gateway.service"

const ACTOR = { principalId: "person-1", workspaceId: "ws-1" }
const MANAGER = ["owner", "manager"]
const HOLD = { name: "order.hold", description: "Hold", inputSchema: { type: "object" }, annotations: {}, meta: {} }

const rowOf = builder<McpConnectorRow>({
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_ref: "MCP_HAKUEN_CLIENT_SECRET",
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 3000,
    tool_catalog: [{ name: "old.tool", hash: "h-old" }],
    catalog_hash: "catalog-1",
    approved_catalog: [],
    approved_at: null,
    checked_at: null,
})

const grantInputOf = builder<GrantInput>({ agentId: "agent-1", tool: "hakuen.booking.confirm", mode: "auto" })

const connectorInputOf = builder<RemoteConnectorInput>({
    key: "hakuen",
    name: " HAKUEN Back-office ",
    url: "https://hakuen.test/mcp",
    contractVersion: "hakuen-mcp@1",
})

const build = async () => {
    const remote = mock<McpRemote>()
    remote.holds.mockImplementation((ref) => ref === "MCP_HAKUEN_CLIENT_SECRET")
    remote.listTools.mockResolvedValue([HOLD])
    remote.ping.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const gateway = mock<McpGatewayService>()
    const connectorRows = mock<McpConnectorsService>()
    connectorRows.list.mockResolvedValue([rowOf(), rowOf({ key: "sepay", kind: "native" })])
    connectorRows.approveCatalog.mockResolvedValue(true)
    const grantRows = mock<McpToolGrantsService>()
    grantRows.set.mockResolvedValue(true)
    const callLines = mock<McpCallLogService>()
    const connections = mock<ConnectionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpGatewayAdminService,
            { provide: MCP_GATEWAY_OPTIONS, useValue: { remote: { credentials: new Map() }, defaultTimeoutMs: 4000 } },
            { provide: MCP_REMOTE, useValue: remote },
            { provide: LOGGER, useValue: logger },
            { provide: McpGatewayService, useValue: gateway },
            { provide: McpConnectorsService, useValue: connectorRows },
            { provide: McpToolGrantsService, useValue: grantRows },
            { provide: McpCallLogService, useValue: callLines },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    const admin = moduleRef.get(McpGatewayAdminService)
    return { admin, remote, logger, gateway, connectorRows, grantRows, callLines, connections }
}

describe("McpGatewayAdminService reads", () => {
    it("lists the connectors with their full tool names and which may run, for an owner or manager", async () => {
        const { admin, gateway, connections } = await build()
        gateway.connectorsOf.mockResolvedValue([
            {
                manifest: SEPAY_MANIFEST,
                status: "active",
                url: null,
                credentialRef: null,
                timeoutMs: 4000,
                approvedTools: null,
                approvedAt: null,
                checkedAt: null,
            },
            {
                manifest: { ...SEPAY_MANIFEST, key: "shop", kind: "remote" },
                status: "degraded",
                url: "https://shop.test/mcp",
                credentialRef: null,
                timeoutMs: 3000,
                approvedTools: new Set<string>(),
                approvedAt: "t1",
                checkedAt: "t2",
            },
        ])

        const views = await admin.connectors(ACTOR)

        expect(views[0]).toEqual({
            key: "sepay",
            name: "SePay",
            kind: "native",
            status: "active",
            url: null,
            credentialRef: null,
            contractVersion: "sepay-native@1",
            timeoutMs: 4000,
            approvedAt: null,
            checkedAt: null,
            tools: [
                {
                    approved: true,
                    name: "sepay.transactions.list",
                    scope: "read",
                    description: SEPAY_MANIFEST.tools[0]?.description,
                },
                {
                    approved: true,
                    name: "sepay.transactions.debits",
                    scope: "read",
                    description: SEPAY_MANIFEST.tools[1]?.description,
                },
            ],
        })
        expect(views[1]).toMatchObject({
            approvedAt: "t1",
            checkedAt: "t2",
            tools: [
                { approved: false, name: "shop.transactions.list" },
                { approved: false, name: "shop.transactions.debits" },
            ],
        })
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, MANAGER)
        expect(gateway.connectorsOf).toHaveBeenCalledWith("ws-1")
    })
})

describe("McpGatewayAdminService reads", () => {
    it("lists the grants of the workspace", async () => {
        const { admin, grantRows } = await build()
        grantRows.listOfWorkspace.mockResolvedValue([
            {
                tool: "sepay.*",
                mode: "auto",
                limit_vnd: null,
                constraints: [],
                agent_id: "a1",
                agent_name: "AI Ke toan",
            },
        ])

        await expect(admin.grants(ACTOR)).resolves.toEqual([
            {
                tool: "sepay.*",
                mode: "auto",
                limitVnd: null,
                constraints: [],
                agentId: "a1",
                agentName: "AI Ke toan",
                constraintsJson: "[]",
            },
        ])
        expect(grantRows.listOfWorkspace).toHaveBeenCalledWith("ws-1")
    })

    it("reads the audit with a bounded page, fifty by default", async () => {
        const { admin, callLines } = await build()
        callLines.latest.mockResolvedValue([])

        await admin.callLog({ actor: ACTOR })
        await admin.callLog({ actor: ACTOR, limit: null })
        await admin.callLog({ actor: ACTOR, limit: 500 })
        await admin.callLog({ actor: ACTOR, limit: 0 })
        await admin.callLog({ actor: ACTOR, limit: 7.4 })

        expect(callLines.latest.mock.calls.map(([page]) => page.limit)).toEqual([50, 50, 200, 1, 7])
        expect(callLines.latest).toHaveBeenCalledWith({ workspaceId: "ws-1", limit: 50 })
    })
})

describe("McpGatewayAdminService.setGrant", () => {
    it("sets a grant with its constraints and the person who set it", async () => {
        const { admin, grantRows } = await build()

        await admin.setGrant(
            ACTOR,
            grantInputOf({ limitVnd: 500000, constraintsJson: '[{"arg":"discountPct","max":5}]' }),
        )
        await admin.setGrant(ACTOR, grantInputOf({ tool: "sepay.*" }))

        expect(grantRows.set.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    tool: "hakuen.booking.confirm",
                    mode: "auto",
                    limitVnd: 500000,
                    constraints: [{ arg: "discountPct", max: 5 }],
                    updatedBy: "person-1",
                },
            ],
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    tool: "sepay.*",
                    mode: "auto",
                    limitVnd: null,
                    constraints: [],
                    updatedBy: "person-1",
                },
            ],
        ])
    })

    it("refuses bad constraints, a bad tool name or a negative limit before writing", async () => {
        const { admin, grantRows } = await build()

        await expect(admin.setGrant(ACTOR, grantInputOf({ constraintsJson: "{}" }))).rejects.toMatchObject({
            code: McpGatewayErrorCode.Invalid,
            params: { field: "constraints" },
        })
        await expect(
            admin.setGrant(ACTOR, grantInputOf({ constraintsJson: '[{"arg":"1x","max":5}]' })),
        ).rejects.toMatchObject({ params: { field: "constraints" } })
        await expect(
            admin.setGrant(
                ACTOR,
                grantInputOf({ constraintsJson: `[{"arg":"Z${"_9".repeat(30)}","max":5}]`, tool: "x" }),
            ),
        ).rejects.toMatchObject({ params: { field: "tool" } })
        await Promise.all(
            ["a-b", "a.b", `a${String.fromCodePoint(0xe9)}`, `a${"b".repeat(61)}`, "_a"].map((arg) =>
                expect(
                    admin.setGrant(ACTOR, grantInputOf({ constraintsJson: JSON.stringify([{ arg, max: 5 }]) })),
                ).rejects.toMatchObject({ params: { field: "constraints" } }),
            ),
        )
        await expect(admin.setGrant(ACTOR, grantInputOf({ tool: "hakuen" }))).rejects.toMatchObject({
            params: { field: "tool" },
        })
        await expect(admin.setGrant(ACTOR, grantInputOf({ limitVnd: -1 }))).rejects.toMatchObject({
            params: { field: "limitVnd" },
        })
        expect(grantRows.set).not.toHaveBeenCalled()
    })

    it("refuses an agent that is not one of the workspace", async () => {
        const { admin, grantRows } = await build()
        grantRows.set.mockResolvedValue(false)

        await expect(admin.setGrant(ACTOR, grantInputOf())).rejects.toMatchObject({
            code: McpGatewayErrorCode.AgentNotFound,
        })
    })
})

describe("McpGatewayAdminService.registerRemote", () => {
    it("registers a remote connector with a held credential name and the default time limit, then reads its catalog", async () => {
        const { admin, connectorRows, remote } = await build()

        await admin.registerRemote(ACTOR, connectorInputOf({ credentialRef: "MCP_HAKUEN_CLIENT_SECRET" }))
        await admin.registerRemote(ACTOR, connectorInputOf({ url: "http://127.0.0.1:3001/mcp", timeoutMs: 2000 }))

        expect(connectorRows.upsertRemote.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    key: "hakuen",
                    name: "HAKUEN Back-office",
                    url: "https://hakuen.test/mcp",
                    credentialRef: "MCP_HAKUEN_CLIENT_SECRET",
                    contractVersion: "hakuen-mcp@1",
                    timeoutMs: 4000,
                },
            ],
            [
                {
                    workspaceId: "ws-1",
                    key: "hakuen",
                    name: "HAKUEN Back-office",
                    url: "http://127.0.0.1:3001/mcp",
                    credentialRef: null,
                    contractVersion: "hakuen-mcp@1",
                    timeoutMs: 2000,
                },
            ],
        ])
        expect(remote.listTools).toHaveBeenCalledTimes(2)
        expect(connectorRows.storeCatalog).toHaveBeenCalledTimes(2)
    })

    it("refuses a bad key, name, URL or credential name, and a credential the integration does not hold", async () => {
        const { admin, connectorRows } = await build()
        const register = (input: RemoteConnectorInput) => admin.registerRemote(ACTOR, input)

        await expect(register(connectorInputOf({ key: "Hakuen" }))).rejects.toMatchObject({ params: { field: "key" } })
        await expect(register(connectorInputOf({ name: "  " }))).rejects.toMatchObject({ params: { field: "name" } })
        await expect(register(connectorInputOf({ url: "not a url" }))).rejects.toMatchObject({
            params: { field: "url" },
        })
        await expect(register(connectorInputOf({ url: "ftp://hakuen.test" }))).rejects.toMatchObject({
            params: { field: "url" },
        })
        await expect(register(connectorInputOf({ credentialRef: "lower" }))).rejects.toMatchObject({
            params: { field: "credentialRef" },
        })
        await expect(register(connectorInputOf({ credentialRef: "MCP_OTHER_SECRET" }))).rejects.toMatchObject({
            code: McpGatewayErrorCode.CredentialMissing,
            params: { ref: "MCP_OTHER_SECRET" },
        })
        expect(connectorRows.upsertRemote).not.toHaveBeenCalled()
    })
})

describe("McpGatewayAdminService.syncCatalog", () => {
    it("stores the listed tools, each pinned by its schema hash, with the catalog hash, and answers the count", async () => {
        const { admin, remote, connectorRows } = await build()
        const catalogJson = JSON.stringify([{ ...HOLD, hash: argsHashOf(HOLD) }])

        await expect(admin.syncCatalog(ACTOR, "hakuen")).resolves.toBe(1)
        expect(remote.listTools).toHaveBeenCalledWith(
            { url: "https://hakuen.test/mcp", credentialRef: "MCP_HAKUEN_CLIENT_SECRET" },
            3000,
        )
        expect(connectorRows.storeCatalog).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            catalogJson,
            catalogHash: createHash("sha256").update(catalogJson).digest("hex"),
            status: "active",
        })
    })

    it("marks an unreachable server degraded, keeps its catalog and logs the failure", async () => {
        const { admin, remote, connectorRows, logger } = await build()
        connectorRows.list.mockResolvedValue([rowOf({ url: null })])
        const down = new Error("down")
        remote.listTools.mockRejectedValue(down)

        await expect(admin.syncCatalog(ACTOR, "hakuen")).resolves.toBe(0)
        expect(remote.listTools).toHaveBeenCalledWith({ url: "", credentialRef: "MCP_HAKUEN_CLIENT_SECRET" }, 3000)
        expect(connectorRows.storeCatalog).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            catalogJson: '[{"name":"old.tool","hash":"h-old"}]',
            catalogHash: "",
            status: "degraded",
        })
        expect(logger.error).toHaveBeenCalledWith(McpGatewayLogEvent.SyncFailed, down, {
            workspaceId: "ws-1",
            connector: "hakuen",
        })
    })

    it("refuses a key that is not a remote connector of the workspace", async () => {
        const { admin, remote } = await build()

        await expect(admin.syncCatalog(ACTOR, "sepay")).rejects.toMatchObject({ code: McpGatewayErrorCode.UnknownTool })
        await expect(admin.syncCatalog(ACTOR, "zalo")).rejects.toMatchObject({ code: McpGatewayErrorCode.UnknownTool })
        expect(remote.listTools).not.toHaveBeenCalled()
    })
})

describe("McpGatewayAdminService.approveCatalog", () => {
    it("approves the live catalog as read, keeps who approved it and logs the approval", async () => {
        const { admin, connectorRows, logger } = await build()

        await expect(admin.approveCatalog(ACTOR, "hakuen")).resolves.toBe(1)
        expect(connectorRows.approveCatalog).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            approvedJson: '[{"name":"old.tool","hash":"h-old"}]',
            catalogHash: "catalog-1",
            approvedBy: "person-1",
        })
        expect(logger.info).toHaveBeenCalledWith(McpGatewayLogEvent.CatalogApproved, {
            workspaceId: "ws-1",
            connector: "hakuen",
            tools: 1,
            approvedBy: "person-1",
        })
    })

    it("refuses a catalog that changed since it was read, and one never read", async () => {
        const { admin, connectorRows, logger } = await build()
        connectorRows.approveCatalog.mockResolvedValue(false)

        await expect(admin.approveCatalog(ACTOR, "hakuen")).rejects.toMatchObject({
            code: McpGatewayErrorCode.CatalogChanged,
            params: { key: "hakuen" },
        })
        connectorRows.list.mockResolvedValue([rowOf({ catalog_hash: "" })])
        connectorRows.approveCatalog.mockClear()
        await expect(admin.approveCatalog(ACTOR, "hakuen")).rejects.toMatchObject({
            code: McpGatewayErrorCode.CatalogChanged,
        })
        expect(connectorRows.approveCatalog).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("refuses a person without the owner or manager role before reading anything", async () => {
        const { admin, connections, connectorRows } = await build()
        const denied = new Error("forbidden")
        connections.authorize.mockRejectedValue(denied)

        await expect(admin.approveCatalog(ACTOR, "hakuen")).rejects.toBe(denied)
        await expect(admin.checkConnector(ACTOR, "hakuen")).rejects.toBe(denied)
        expect(connectorRows.list).not.toHaveBeenCalled()
        expect(connectorRows.approveCatalog).not.toHaveBeenCalled()
    })
})

describe("McpGatewayAdminService.checkConnector", () => {
    it("records active when the server answers ping within its limit", async () => {
        const { admin, remote, connectorRows } = await build()

        await expect(admin.checkConnector(ACTOR, "hakuen")).resolves.toBe("active")
        expect(remote.ping).toHaveBeenCalledWith(
            { url: "https://hakuen.test/mcp", credentialRef: "MCP_HAKUEN_CLIENT_SECRET" },
            3000,
        )
        expect(connectorRows.recordHealth).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            status: "active",
        })
    })

    it("records degraded and logs when it does not", async () => {
        const { admin, remote, connectorRows, logger } = await build()
        connectorRows.list.mockResolvedValue([rowOf({ url: null })])
        const down = new Error("down")
        remote.ping.mockRejectedValue(down)

        await expect(admin.checkConnector(ACTOR, "hakuen")).resolves.toBe("degraded")
        expect(remote.ping).toHaveBeenCalledWith({ url: "", credentialRef: "MCP_HAKUEN_CLIENT_SECRET" }, 3000)
        expect(connectorRows.recordHealth).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            status: "degraded",
        })
        expect(logger.error).toHaveBeenCalledWith(McpGatewayLogEvent.HealthFailed, down, {
            workspaceId: "ws-1",
            connector: "hakuen",
        })
    })
})
