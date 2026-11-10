import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { McpConnectorAccessService } from "./mcp-connector-access.service"
import type { ProviderAttachmentRecord } from "./mcp-tool-grants.contracts"
import { McpConnectorAccessEntity } from "./persistence/entities"

const entityOf = builder<McpConnectorAccessEntity>({
    id: "access-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    provider: "zalo_oa",
    abilities: { "customer.send": "ask" },
    updatedBy: null,
    createdAt: new Date("2026-11-10T00:00:00.000Z"),
    updatedAt: new Date("2026-11-10T00:00:00.000Z"),
})

const recordOf = builder<ProviderAttachmentRecord>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    provider: "zalo_oa",
    abilities: { "customer.send": "auto" },
})

/** The agents of each workspace: agent-1 of ws-1. */
const OWNED: ReadonlySet<string> = new Set(["ws-1:agent-1"])

const build = async (entityManager: MockEntityManager) => {
    const agents = mock<AgentDirectoryService>({
        cardsOf: jest.fn((workspaceId: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(
                ids
                    .filter((id) => OWNED.has(`${workspaceId}:${id}`))
                    .map((id) => ({ id, name: id, module: "sales", canTagAgentIds: [] })),
            ),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpConnectorAccessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return moduleRef.get(McpConnectorAccessService)
}

describe("McpConnectorAccessService", () => {
    it("reads the attachments of one agent and of a workspace, and counts only well-formed ticks", async () => {
        const damaged = entityOf({ provider: "sepay", abilities: { "qr.create": "auto", junk: "write" } as never })
        const entityManager = mockEntityManager({ find: [McpConnectorAccessEntity, [entityOf(), damaged]] })
        const service = await build(entityManager)

        const views = [
            { agentId: "agent-1", provider: "zalo_oa", abilities: { "customer.send": "ask" } },
            { agentId: "agent-1", provider: "sepay", abilities: { "qr.create": "auto" } },
        ]
        await expect(service.listOfAgent("ws-1", "agent-1")).resolves.toEqual(views)
        await expect(service.listOfWorkspace("ws-1")).resolves.toEqual(views)
        expect(entityManager.find).toHaveBeenNthCalledWith(1, McpConnectorAccessEntity, {
            where: { workspaceId: "ws-1", agentId: "agent-1" },
            order: { provider: "ASC" },
            take: 500,
        })
    })

    it("attaches an agent of the workspace once: an attachment it holds is left as it is, a stranger gets nothing", async () => {
        const entityManager = mockEntityManager({ insert: [McpConnectorAccessEntity, {}] })
        entityManager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(entityOf())
        const service = await build(entityManager)

        await expect(service.attach(recordOf(), "owner-1")).resolves.toBe("attached")
        await expect(service.attach(recordOf(), "owner-1")).resolves.toBe("held")
        await expect(service.attach(recordOf({ agentId: "agent-9" }), "owner-1")).resolves.toBe("unknown_agent")

        expect(entityManager.insert).toHaveBeenCalledTimes(1)
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, { ...recordOf(), updatedBy: "owner-1" })
    })

    it("detaches by deleting the row, and says when there was none", async () => {
        const entityManager = mockEntityManager({})
        entityManager.delete.mockResolvedValueOnce({ affected: 1, raw: [] }).mockResolvedValueOnce({ affected: 0, raw: [] })
        const service = await build(entityManager)

        await expect(service.detach("ws-1", "agent-1", "zalo_oa")).resolves.toBe(true)
        await expect(service.detach("ws-1", "agent-1", "zalo_oa")).resolves.toBe(false)
        expect(entityManager.delete).toHaveBeenCalledWith(McpConnectorAccessEntity, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            provider: "zalo_oa",
        })
    })

    it("creates only the attachments that do not exist yet, of agents of their workspace, and never touches one that is held", async () => {
        const entityManager = mockEntityManager({
            find: [McpConnectorAccessEntity, [entityOf({ provider: "zalo_oa" })]],
            insert: [McpConnectorAccessEntity, {}],
        })
        const service = await build(entityManager)

        await expect(
            service.insertMissing([
                recordOf({ provider: "zalo_oa" }),
                recordOf({ provider: "telegram" }),
                recordOf({ provider: "telegram" }),
                recordOf({ agentId: "agent-9", provider: "meta" }),
            ]),
        ).resolves.toEqual([recordOf({ provider: "telegram" })])
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, [
            { ...recordOf({ provider: "telegram" }), updatedBy: null },
        ])
        expect(entityManager.update).not.toHaveBeenCalled()
        await expect(service.insertMissing([recordOf({ agentId: "agent-9" })])).resolves.toEqual([])
    })
})
