import { Test } from "@nestjs/testing"
import { IsNull, Not } from "typeorm"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { McpConnectorRecord } from "./mcp-connectors.contracts"
import { McpConnectorsService } from "./mcp-connectors.service"
import { McpConnectorEntity } from "./persistence/entities"

const rowOf = builder<McpConnectorRecord>({
    key: "hakuen",
    name: "HAKUEN Back-office",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_state: "set",
    credential_set_at: "2026-10-20T01:00:00.000Z",
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: [],
    catalog_hash: "",
    approved_catalog: [],
    approved_at: null,
    checked_at: null,
})

const entityOf = builder<McpConnectorEntity>({
    id: "id-1",
    workspaceId: "ws-1",
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    status: "active",
    contractVersion: "hakuen-mcp@1",
    timeoutMs: 4000,
    toolCatalog: [],
    catalogHash: "",
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    approvedCatalog: [],
    approvedBy: null,
    approvedAt: null,
    checkedAt: null,
    credentialState: "set",
    credentialSealed: "sealed-text",
    credentialSetBy: null,
    credentialSetAt: null,
})

const build = async (entityManager: MockEntityManager): Promise<McpConnectorsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [McpConnectorsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(McpConnectorsService)
}

/** What an update query builder was told to set; a function value is read as its source text. */
const setBy = (fake: FakeQueryBuilder | undefined): Record<string, unknown> => {
    const [values] = fake?.callsOf("set")[0] ?? []
    const written = typeof values === "object" && values !== null ? values : {}
    return Object.fromEntries(
        Object.entries(written).map(([key, value]) => [key, typeof value === "function" ? "<expression>" : value]),
    )
}

describe("McpConnectorsService rows", () => {
    it("lists the connector rows of the workspace, the times as ISO text and never the sealed credential", async () => {
        const em = mockEntityManager()
        const [list] = queueQueryBuilders(em, [{ getRawMany: [rowOf()] }])
        const connectors = await build(em)

        await expect(connectors.list("ws-1")).resolves.toEqual([rowOf()])
        expect(list?.callsOf("addSelect")).toContainEqual([
            "to_json(c.credential_set_at) #>> '{}'",
            "credential_set_at",
        ])
        expect(list?.callsOf("addSelect")).toContainEqual(["to_json(c.approved_at) #>> '{}'", "approved_at"])
        expect(list?.callsOf("addSelect")).toContainEqual(["to_json(c.checked_at) #>> '{}'", "checked_at"])
        expect(JSON.stringify(list?.callsOf("addSelect"))).not.toContain("redential_sealed")
        expect(list?.callsOf("where")).toEqual([["c.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(list?.callsOf("orderBy")).toEqual([["c.key", "ASC"]])
        expect(list?.callsOf("limit")).toEqual([[200]])
    })

    it("registers a remote connector, a server that now takes a credential becoming needed", async () => {
        const em = mockEntityManager({ update: [McpConnectorEntity, {}] })
        const tx = fakeTransaction(em)
        const [insert] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
        const connectors = await build(em)

        await expect(
            connectors.upsertRemote({
                workspaceId: "ws-1",
                key: "hakuen",
                name: "HAKUEN",
                url: "https://hakuen.test/mcp",
                needsCredential: true,
                contractVersion: "hakuen-mcp@1",
                timeoutMs: 4000,
            }),
        ).resolves.toBeUndefined()

        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    key: "hakuen",
                    name: "HAKUEN",
                    kind: "remote",
                    url: "https://hakuen.test/mcp",
                    credentialState: "needed",
                    contractVersion: "hakuen-mcp@1",
                    timeoutMs: 4000,
                },
            ],
        ])
        expect(insert?.callsOf("orUpdate")).toEqual([
            [
                ["name", "url", "contract_version", "timeout_ms", "updated_at"],
                ["workspace_id", "key"],
            ],
        ])
        expect(tx.em.update).toHaveBeenCalledWith(
            McpConnectorEntity,
            { workspaceId: "ws-1", key: "hakuen", credentialState: "none" },
            { credentialState: "needed" },
        )
        expect(tx.commits).toBe(1)
    })
})

describe("McpConnectorsService registration", () => {
    it("registers a connector that takes no credential without touching the credential state", async () => {
        const em = mockEntityManager()
        const tx = fakeTransaction(em)
        const [insert] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
        const connectors = await build(em)

        await connectors.upsertRemote({
            workspaceId: "ws-1",
            key: "hakuen",
            name: "HAKUEN",
            url: "https://hakuen.test/mcp",
            needsCredential: false,
            contractVersion: "hakuen-mcp@1",
            timeoutMs: 4000,
        })

        expect(insert?.callsOf("values")[0]?.[0]).toMatchObject({ credentialState: "none" })
        expect(tx.em.update).not.toHaveBeenCalled()
    })

    it("stores a catalog snapshot with its hash and status", async () => {
        const em = mockEntityManager()
        const [update] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
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

        expect(setBy(update)).toEqual({
            toolCatalog: "<expression>",
            catalogHash: "abc",
            status: "active",
            checkedAt: "<expression>",
            updatedAt: "<expression>",
        })
        expect(update?.callsOf("setParameter")).toEqual([["catalogJson", "[]"]])
        expect(update?.callsOf("where")).toEqual([
            ["workspace_id = :workspaceId AND key = :key", { workspaceId: "ws-1", key: "hakuen" }],
        ])
    })
})

describe("McpConnectorsService credential", () => {
    it("stores a sealed credential and answers whether a remote connector of that key was written", async () => {
        const em = mockEntityManager()
        const [written, missing] = queueQueryBuilders(em, [
            { execute: { raw: [{ key: "hakuen" }] } },
            { execute: { raw: [] } },
        ])
        const connectors = await build(em)
        const record = { workspaceId: "ws-1", key: "hakuen", sealed: "sealed-text", setBy: "person-1" }

        await expect(connectors.setCredential(record)).resolves.toBe(true)
        await expect(connectors.setCredential(record)).resolves.toBe(false)
        expect(setBy(written)).toEqual({
            credentialState: "set",
            credentialSealed: "sealed-text",
            credentialSetBy: "person-1",
            credentialSetAt: "<expression>",
            updatedAt: "<expression>",
        })
        expect(written?.callsOf("where")).toEqual([
            ["workspace_id = :workspaceId AND key = :key AND kind = 'remote'", { workspaceId: "ws-1", key: "hakuen" }],
        ])
        expect(missing?.callsOf("returning")).toEqual([["key"]])
    })

    it("reads the stored credential of a remote connector, and null when there is none", async () => {
        const em = mockEntityManager({
            findOne: [
                [McpConnectorEntity, entityOf()],
                [McpConnectorEntity, null],
            ],
        })
        const connectors = await build(em)

        await expect(connectors.storedCredential("ws-1", "hakuen")).resolves.toEqual({
            state: "set",
            sealed: "sealed-text",
        })
        await expect(connectors.storedCredential("ws-1", "other")).resolves.toBeNull()
        expect(em.findOne.mock.calls[0]?.[1]).toEqual({
            select: { credentialState: true, credentialSealed: true },
            where: { workspaceId: "ws-1", key: "hakuen", kind: "remote" },
        })
    })

    it("samples one sealed credential of any workspace for the boot key proof, and null when none is sealed", async () => {
        const em = mockEntityManager({
            findOne: [
                [McpConnectorEntity, entityOf()],
                [McpConnectorEntity, null],
            ],
        })
        const connectors = await build(em)

        await expect(connectors.sealedSample()).resolves.toBe("sealed-text")
        await expect(connectors.sealedSample()).resolves.toBeNull()
        expect(em.findOne.mock.calls[0]?.[1]).toEqual({
            select: { credentialSealed: true },
            where: { credentialSealed: Not(IsNull()) },
        })
    })
})

describe("McpConnectorsService approval and health", () => {
    it("approves the catalog the approval was made on, and answers false when it changed", async () => {
        const em = mockEntityManager()
        const [approved] = queueQueryBuilders(em, [{ execute: { raw: [{ key: "hakuen" }] } }, { execute: { raw: [] } }])
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
        expect(setBy(approved)).toEqual({
            approvedCatalog: "<expression>",
            approvedBy: "person-1",
            approvedAt: "<expression>",
            updatedAt: "<expression>",
        })
        expect(approved?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND key = :key AND kind = 'remote' AND catalog_hash = :catalogHash",
                { workspaceId: "ws-1", key: "hakuen", catalogHash: "abc" },
            ],
        ])
        expect(approved?.callsOf("setParameter")).toEqual([["approvedJson", '[{"name":"booking.hold","hash":"h1"}]']])
    })

    it("records a health check, leaving a disabled connector disabled", async () => {
        const em = mockEntityManager({ update: [McpConnectorEntity, {}] })
        const connectors = await build(em)

        await expect(
            connectors.recordHealth({ workspaceId: "ws-1", key: "hakuen", status: "degraded" }),
        ).resolves.toBeUndefined()

        const [, criteria, changes] = em.update.mock.calls[0] ?? []
        expect(criteria).toEqual({ workspaceId: "ws-1", key: "hakuen", status: Not("disabled") })
        expect(changes).toMatchObject({ status: "degraded" })
    })
})
