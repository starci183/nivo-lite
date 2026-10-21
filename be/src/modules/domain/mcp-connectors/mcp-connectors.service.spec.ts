import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { McpConnectorsService } from "./mcp-connectors.service"
import type { McpConnectorRow } from "./persistence/mcp-connectors.rows"
import {
    APPROVE_CATALOG,
    LIST_CONNECTORS,
    RECORD_HEALTH,
    UPDATE_CATALOG,
    UPSERT_REMOTE_CONNECTOR,
} from "./persistence/mcp-connectors.sql"

const rowOf = builder<McpConnectorRow>({
    key: "hakuen",
    name: "HAKUEN Back-office",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_ref: "MCP_HAKUEN_CLIENT_SECRET",
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: [],
    catalog_hash: "",
    approved_catalog: [],
    approved_at: null,
    checked_at: null,
})

const build = async (entityManager: MockEntityManager): Promise<McpConnectorsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [McpConnectorsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(McpConnectorsService)
}

describe("McpConnectorsService rows", () => {
    it("lists the connector rows of the workspace", async () => {
        const em = mockEntityManager({ query: [LIST_CONNECTORS, [rowOf()]] })
        const connectors = await build(em)

        await expect(connectors.list("ws-1")).resolves.toEqual([rowOf()])
        expect(em.query).toHaveBeenCalledWith(LIST_CONNECTORS, ["ws-1"])
    })

    it("registers a remote connector with every column in order", async () => {
        const em = mockEntityManager({ query: [UPSERT_REMOTE_CONNECTOR, []] })
        const connectors = await build(em)

        await expect(
            connectors.upsertRemote({
                workspaceId: "ws-1",
                key: "hakuen",
                name: "HAKUEN",
                url: "https://hakuen.test/mcp",
                credentialRef: null,
                contractVersion: "hakuen-mcp@1",
                timeoutMs: 4000,
            }),
        ).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(UPSERT_REMOTE_CONNECTOR, [
            "ws-1",
            "hakuen",
            "HAKUEN",
            "https://hakuen.test/mcp",
            null,
            "hakuen-mcp@1",
            4000,
        ])
    })

    it("stores a catalog snapshot with its hash and status", async () => {
        const em = mockEntityManager({ query: [UPDATE_CATALOG, []] })
        const connectors = await build(em)

        await expect(
            connectors.storeCatalog({
                workspaceId: "ws-1",
                key: "hakuen",
                catalogJson: "[]",
                catalogHash: "abc",
                status: "active",
            }),
        ).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(UPDATE_CATALOG, ["ws-1", "hakuen", "[]", "abc", "active"])
    })
})

describe("McpConnectorsService approval and health", () => {
    it("approves the catalog the approval was made on, and answers false when it changed", async () => {
        const em = mockEntityManager({
            query: [
                [APPROVE_CATALOG, [{ key: "hakuen" }]],
                [APPROVE_CATALOG, []],
            ],
        })
        const connectors = await build(em)
        const approval = {
            workspaceId: "ws-1",
            key: "hakuen",
            approvedJson: '[{"name":"booking.hold","hash":"h1"}]',
            catalogHash: "abc",
            approvedBy: "person-1",
        }

        await expect(connectors.approveCatalog(approval)).resolves.toBe(true)
        await expect(connectors.approveCatalog(approval)).resolves.toBe(false)
        expect(em.query).toHaveBeenCalledWith(APPROVE_CATALOG, [
            "ws-1",
            "hakuen",
            '[{"name":"booking.hold","hash":"h1"}]',
            "abc",
            "person-1",
        ])
    })

    it("records a health check", async () => {
        const em = mockEntityManager({ query: [RECORD_HEALTH, []] })
        const connectors = await build(em)

        await expect(
            connectors.recordHealth({ workspaceId: "ws-1", key: "hakuen", status: "degraded" }),
        ).resolves.toBeUndefined()
        expect(em.query).toHaveBeenCalledWith(RECORD_HEALTH, ["ws-1", "hakuen", "degraded"])
    })
})
