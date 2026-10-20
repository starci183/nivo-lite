import { mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { McpRemoteClient } from "@modules/integrations/mcp"
import { Secret } from "@modules/platform/config"
import { SEPAY_MANIFEST } from "./adapters/sepay-native.adapter"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import { McpGatewayAdminService } from "./mcp-gateway-admin.service"
import type { GrantInput } from "./mcp-gateway-admin.service"
import { McpGatewayService } from "./mcp-gateway.service"
import {
    LIST_CALL_LOG,
    LIST_CONNECTORS,
    LIST_WORKSPACE_GRANTS,
    UPDATE_CATALOG,
    UPSERT_GRANT,
    UPSERT_REMOTE_CONNECTOR,
} from "./persistence/mcp-gateway.sql"

const ROW = {
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_ref: "MCP_HAKUEN_CLIENT_SECRET",
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: [],
}

const build = (answers: ReadonlyMap<string, unknown> = new Map()) => {
    const entityManager = mockEntityManager()
    entityManager.query.mockImplementation((query: string) => Promise.resolve(answers.get(query) ?? []))
    const gateway = mock<McpGatewayService>()
    const remote = mock<McpRemoteClient>()
    const options = {
        credentials: new Map([["MCP_HAKUEN_CLIENT_SECRET", new Secret("s")]]),
        agentToken: null,
        defaultTimeoutMs: 4000,
    }
    const service = new McpGatewayAdminService(entityManager, options, gateway, remote, mock<ConnectionsService>())
    return { service, entityManager, gateway, remote }
}

const ACTOR = { principalId: "u", workspaceId: "ws" }

const invalid = (field: string) => new McpGatewayError({ code: McpGatewayErrorCode.Invalid, params: { field } })

describe("McpGatewayAdminService", () => {
    it("lists the connectors with their full tool names", async () => {
        const { service, gateway } = build()
        gateway.connectorsOf.mockResolvedValue([
            { manifest: SEPAY_MANIFEST, status: "active", url: null, credentialRef: null, timeoutMs: 4000 },
        ])
        const [view] = await service.connectors(ACTOR)
        expect(view).toMatchObject({ key: "sepay", kind: "native", contractVersion: "sepay-native@1" })
        expect(view?.tools[0]?.name).toBe("sepay.transactions.list")
    })

    it("lists grants and a bounded audit page", async () => {
        const { service, entityManager } = build(
            new Map<string, unknown>([
                [
                    LIST_WORKSPACE_GRANTS,
                    [
                        {
                            agent_id: "a",
                            agent_name: "Sales",
                            tool: "hakuen.*",
                            mode: "auto",
                            limit_vnd: null,
                            constraintsJson: '[{\"arg\":\"discountPct\",\"max\":10}]',
                        },
                    ],
                ],
            ]),
        )
        await expect(service.grants(ACTOR)).resolves.toEqual([
            {
                agentId: "a",
                agentName: "Sales",
                tool: "hakuen.*",
                mode: "auto",
                limitVnd: null,
                constraintsJson: '[{\"arg\":\"discountPct\",\"max\":10}]',
            },
        ])
        await expect(service.callLog(ACTOR, 999)).resolves.toEqual([])
        await service.callLog(ACTOR, -3)
        expect(
            entityManager.query.mock.calls.filter((call) => call[0] === LIST_CALL_LOG).map((call) => call[1]),
        ).toEqual([
            ["ws", 200],
            ["ws", 1],
        ])
    })

    it("sets a grant of an exact tool or a wildcard, and refuses bad input or a foreign agent", async () => {
        const { service, entityManager } = build(new Map([[UPSERT_GRANT, [{ id: "g" }]]]))
        const grant: GrantInput = {
            agentId: "a",
            tool: "hakuen.booking.confirm",
            mode: "auto",
            limitVnd: null,
            constraintsJson: '[{\"arg\":\"discountPct\",\"max\":10}]',
        }
        await service.setGrant(ACTOR, grant)
        await service.setGrant(ACTOR, { ...grant, tool: "hakuen.*" })
        expect(entityManager.query).toHaveBeenCalledWith(UPSERT_GRANT, [
            "ws",
            "a",
            "hakuen.booking.confirm",
            "auto",
            null,
            10,
            "u",
        ])
        await expect(service.setGrant(ACTOR, { ...grant, tool: "booking" })).rejects.toEqual(invalid("tool"))
        await expect(service.setGrant(ACTOR, { ...grant, tool: "Bad.*" })).rejects.toEqual(invalid("tool"))
        await expect(service.setGrant(ACTOR, { ...grant, limitVnd: -1 })).rejects.toEqual(invalid("limitVnd"))
        await expect(service.setGrant(ACTOR, { ...grant, constraintsJson: '[{"arg":"1x","max":1}]' })).rejects.toEqual(
            invalid("constraints"),
        )
        const foreign = build()
        await expect(foreign.service.setGrant(ACTOR, grant)).rejects.toEqual(
            new McpGatewayError({ code: McpGatewayErrorCode.AgentNotFound }),
        )
    })

    it("registers a remote connector by credential NAME only", async () => {
        const { service, entityManager } = build()
        const input = {
            key: "hakuen",
            name: " HAKUEN ",
            url: "https://hakuen.test/mcp",
            credentialRef: "MCP_HAKUEN_CLIENT_SECRET",
            contractVersion: "hakuen-mcp@1",
            timeoutMs: null,
        }
        await service.registerRemote(ACTOR, input)
        await service.registerRemote(ACTOR, { ...input, credentialRef: null, timeoutMs: 2000 })
        expect(entityManager.query.mock.calls.map((call) => call[1])).toEqual([
            ["ws", "hakuen", "HAKUEN", "https://hakuen.test/mcp", "MCP_HAKUEN_CLIENT_SECRET", "hakuen-mcp@1", 4000],
            ["ws", "hakuen", "HAKUEN", "https://hakuen.test/mcp", null, "hakuen-mcp@1", 2000],
        ])
        expect(entityManager.query.mock.calls[0]?.[0]).toBe(UPSERT_REMOTE_CONNECTOR)
        await expect(service.registerRemote(ACTOR, { ...input, key: "X" })).rejects.toEqual(invalid("key"))
        await expect(service.registerRemote(ACTOR, { ...input, name: " " })).rejects.toEqual(invalid("name"))
        await expect(service.registerRemote(ACTOR, { ...input, url: "ftp://x" })).rejects.toEqual(invalid("url"))
        await expect(service.registerRemote(ACTOR, { ...input, url: "not a url" })).rejects.toEqual(invalid("url"))
        await expect(service.registerRemote(ACTOR, { ...input, credentialRef: "lower" })).rejects.toEqual(
            invalid("credentialRef"),
        )
        await expect(service.registerRemote(ACTOR, { ...input, credentialRef: "MCP_OTHER" })).rejects.toEqual(
            new McpGatewayError({ code: McpGatewayErrorCode.CredentialMissing, params: { ref: "MCP_OTHER" } }),
        )
    })

    it("syncs the catalog from tools/list, and marks the connector degraded when it fails", async () => {
        const { service, entityManager, remote } = build(
            new Map([[LIST_CONNECTORS, [ROW, { ...ROW, key: "open", credential_ref: null }]]]),
        )
        remote.listTools.mockResolvedValueOnce([{ name: "rates.quote", description: "Quote", inputSchema: {} }])
        await expect(service.syncCatalog(ACTOR, "hakuen")).resolves.toBe(1)
        expect(remote.listTools).toHaveBeenCalledWith({ url: "https://hakuen.test/mcp", bearer: "s" }, 4000)
        remote.listTools.mockRejectedValueOnce(new Error("down"))
        await expect(service.syncCatalog(ACTOR, "open")).resolves.toBe(0)
        expect(remote.listTools.mock.calls[1]?.[0]).toEqual({ url: "https://hakuen.test/mcp", bearer: null })
        const updates = entityManager.query.mock.calls
            .filter((call) => call[0] === UPDATE_CATALOG)
            .map((call) => call[1])
        expect(updates[0]).toEqual([
            "ws",
            "hakuen",
            '[{"name":"rates.quote","description":"Quote","inputSchema":{}}]',
            expect.any(String),
            "active",
        ])
        expect(updates[1]).toEqual(["ws", "open", "[]", "", "degraded"])
        await expect(service.syncCatalog(ACTOR, "missing")).rejects.toBeInstanceOf(McpGatewayError)
        const bare = build(new Map([[LIST_CONNECTORS, [{ ...ROW, url: null, credential_ref: null }]]]))
        bare.remote.listTools.mockResolvedValueOnce([])
        await expect(bare.service.syncCatalog(ACTOR, "hakuen")).resolves.toBe(0)
        expect(bare.remote.listTools.mock.calls[0]?.[0]).toEqual({ url: "", bearer: null })
    })
})
