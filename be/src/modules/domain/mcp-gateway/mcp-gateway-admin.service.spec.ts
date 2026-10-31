import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { McpConnectorsService } from "@modules/domain/mcp-connectors"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { MCP_REMOTE } from "@modules/integrations/mcp"
import type { McpRemote } from "@modules/integrations/mcp"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.service"
import { argsHashOf } from "./audit-mask.policy"
import { McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { McpConnectorCredentialService } from "./mcp-connector-credential.service"
import type { GrantInput, NativeAdapter, RemoteConnectorInput } from "./mcp-gateway.contracts"
import { MCP_GATEWAY_OPTIONS, NATIVE_ADAPTERS } from "./mcp-gateway.decorators"
import { McpGatewayAdminService } from "./mcp-gateway-admin.service"
import { McpGatewayLogEvent } from "./mcp-gateway.log-events"
import { McpGatewayService } from "./mcp-gateway.service"
import { GATEWAY_BEARER as BEARER, openedEndpointOf } from "@tests/fixtures/builders/mcp-gateway.builder"
import { hakuenConnectorRowOf as rowOf } from "@tests/fixtures/builders/mcp-gateway-admin.builder"

const ACTOR = { principalId: "person-1", workspaceId: "ws-1" }
const MANAGER = ["owner", "manager"]
const HOLD = { name: "order.hold", description: "Hold", inputSchema: { type: "object" }, annotations: {}, meta: {} }

const grantInputOf = builder<GrantInput>({ agentId: "agent-1", tool: "hakuen.booking.confirm", mode: "auto" })

const connectorInputOf = builder<RemoteConnectorInput>({
    key: "hakuen",
    name: " HAKUEN Back-office ",
    url: "https://hakuen.test/mcp",
    contractVersion: "hakuen-mcp@1",
})

const build = async () => {
    const remote = mock<McpRemote>()
    remote.listTools.mockResolvedValue([HOLD])
    remote.ping.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const gateway = mock<McpGatewayService>()
    const credentials = mock<McpConnectorCredentialService>()
    credentials.endpointOf.mockImplementation(openedEndpointOf)
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
            { provide: MCP_GATEWAY_OPTIONS, useValue: { defaultTimeoutMs: 4000 } },
            { provide: NATIVE_ADAPTERS, useValue: [mock<NativeAdapter>({ manifest: SEPAY_MANIFEST })] },
            { provide: MCP_REMOTE, useValue: remote },
            { provide: LOGGER, useValue: logger },
            { provide: McpGatewayService, useValue: gateway },
            { provide: McpConnectorsService, useValue: connectorRows },
            { provide: McpToolGrantsService, useValue: grantRows },
            { provide: McpCallLogService, useValue: callLines },
            { provide: ConnectionsService, useValue: connections },
            { provide: McpConnectorCredentialService, useValue: credentials },
        ],
    }).compile()
    const admin = moduleRef.get(McpGatewayAdminService)
    return { admin, remote, logger, gateway, credentials, connectorRows, grantRows, callLines, connections }
}

describe("McpGatewayAdminService reads", () => {
    it("lists the connectors with their full tool names and which may run, for an owner or manager", async () => {
        const { admin, gateway, connections } = await build()
        gateway.connectorsOf.mockResolvedValue([
            {
                manifest: SEPAY_MANIFEST,
                status: "active",
                url: null,
                credentialState: "none",
                credentialSetAt: null,
                timeoutMs: 4000,
                approvedTools: null,
                approvedAt: null,
                checkedAt: null,
            },
            {
                manifest: { ...SEPAY_MANIFEST, key: "shop", kind: "remote" },
                status: "degraded",
                url: "https://shop.test/mcp",
                credentialState: "set",
                credentialSetAt: "t0",
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
            credentialState: "none",
            credentialSetAt: null,
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
            credentialState: "set",
            credentialSetAt: "t0",
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

describe("McpGatewayAdminService.registerRemote and setCredential", () => {
    it("registers a remote connector, seals the bearer entered with it, then reads its catalog with it", async () => {
        const { admin, connectorRows, remote, credentials } = await build()

        await admin.registerRemote(ACTOR, connectorInputOf({ credential: "bearer-1" }))

        expect(connectorRows.upsertRemote).toHaveBeenCalledWith(
            expect.objectContaining({ needsCredential: true, timeoutMs: 4000 }),
        )
        expect(credentials.store).toHaveBeenCalledWith(ACTOR, "hakuen", "bearer-1")
        expect(remote.listTools).toHaveBeenCalledWith({ url: "https://hakuen.test/mcp", bearer: BEARER }, 3000)
        expect(connectorRows.storeCatalog).toHaveBeenCalledTimes(1)
    })

    it("registers a server that takes no bearer without storing one, or leaves one not entered yet unread", async () => {
        const { admin, connectorRows, remote, credentials } = await build()
        const url = "http://127.0.0.1:3001/mcp"
        connectorRows.list.mockResolvedValueOnce([rowOf({ credential_state: "none", url })])

        await admin.registerRemote(ACTOR, connectorInputOf({ url, timeoutMs: 2000 }))
        connectorRows.list.mockResolvedValueOnce([rowOf({ credential_state: "needed" })])
        await admin.registerRemote(ACTOR, connectorInputOf({ needsCredential: true }))

        const written = connectorRows.upsertRemote.mock.calls.map(
            ([record]) => `${record.needsCredential}/${record.timeoutMs}`,
        )
        expect(written).toEqual(["false/2000", "true/4000"])
        expect(credentials.store).not.toHaveBeenCalled()
        expect(remote.listTools.mock.calls).toEqual([[{ url, bearer: null }, 3000]])
    })

    it("refuses a bad or native-held key, name, URL or bearer before writing anything", async () => {
        const { admin, connectorRows, credentials } = await build()
        const register = (input: RemoteConnectorInput) => admin.registerRemote(ACTOR, input)

        await expect(register(connectorInputOf({ key: "Hakuen" }))).rejects.toMatchObject({ params: { field: "key" } })
        await expect(register(connectorInputOf({ key: "sepay" }))).rejects.toMatchObject({ params: { field: "key" } })
        await expect(register(connectorInputOf({ name: "  " }))).rejects.toMatchObject({ params: { field: "name" } })
        await expect(register(connectorInputOf({ url: "ftp://x.test" }))).rejects.toMatchObject({
            params: { field: "url" },
        })
        await expect(register(connectorInputOf({ credential: "line\nbreak" }))).rejects.toMatchObject({
            code: McpGatewayErrorCode.Invalid,
            params: { field: "credential" },
        })
        expect(connectorRows.upsertRemote).not.toHaveBeenCalled()
        expect(credentials.store).not.toHaveBeenCalled()
    })

    it("seals a new bearer (a rotation), then reads the catalog with it", async () => {
        const { admin, remote, credentials } = await build()

        await expect(admin.setCredential(ACTOR, { key: "hakuen", credential: new Secret("rotated") })).resolves.toBe(1)

        expect(credentials.store).toHaveBeenCalledWith(ACTOR, "hakuen", "rotated")
        expect(remote.listTools).toHaveBeenCalledWith({ url: "https://hakuen.test/mcp", bearer: BEARER }, 3000)
    })

    it("refuses a blank bearer, and a person without a role that manages connections, before sealing anything", async () => {
        const { admin, connections, credentials, connectorRows } = await build()

        await expect(admin.setCredential(ACTOR, { key: "hakuen", credential: new Secret(" ") })).rejects.toMatchObject({
            code: McpGatewayErrorCode.Invalid,
            params: { field: "credential" },
        })
        const denied = new Error("forbidden")
        connections.authorize.mockRejectedValue(denied)
        await expect(admin.setCredential(ACTOR, { key: "hakuen", credential: new Secret("x") })).rejects.toBe(denied)
        await expect(admin.registerRemote(ACTOR, connectorInputOf({ credential: "x" }))).rejects.toBe(denied)
        expect(credentials.store).not.toHaveBeenCalled()
        expect(connectorRows.upsertRemote).not.toHaveBeenCalled()
    })
})

describe("McpGatewayAdminService.syncCatalog", () => {
    it("stores the listed tools, each pinned by its schema hash, with the catalog hash, and answers the count", async () => {
        const { admin, remote, connectorRows } = await build()
        const catalogJson = JSON.stringify([{ ...HOLD, hash: argsHashOf(HOLD) }])

        await expect(admin.syncCatalog(ACTOR, "hakuen")).resolves.toBe(1)
        expect(remote.listTools).toHaveBeenCalledWith({ url: "https://hakuen.test/mcp", bearer: BEARER }, 3000)
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
        expect(remote.listTools).toHaveBeenCalledWith({ url: "", bearer: BEARER }, 3000)
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
        expect(remote.ping).toHaveBeenCalledWith({ url: "https://hakuen.test/mcp", bearer: BEARER }, 3000)
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
        expect(remote.ping).toHaveBeenCalledWith({ url: "", bearer: BEARER }, 3000)
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
    it("records a connector whose credential cannot be opened as degraded without reaching the server", async () => {
        const { admin, credentials, remote, connectorRows, logger } = await build()
        const missing = new Error("credential missing")
        credentials.endpointOf.mockRejectedValue(missing)

        await expect(admin.checkConnector(ACTOR, "hakuen")).resolves.toBe("degraded")
        await expect(admin.syncCatalog(ACTOR, "hakuen")).resolves.toBe(0)
        expect(remote.ping).not.toHaveBeenCalled()
        expect(remote.listTools).not.toHaveBeenCalled()
        expect(connectorRows.recordHealth).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            key: "hakuen",
            status: "degraded",
        })
        expect(logger.error).toHaveBeenCalledWith(McpGatewayLogEvent.HealthFailed, missing, {
            workspaceId: "ws-1",
            connector: "hakuen",
        })
        expect(credentials.endpointOf).toHaveBeenCalledWith("ws-1", expect.objectContaining({ credentialState: "set" }))
    })
})
