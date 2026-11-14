import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AccountAttachmentsService } from "./account-attachments.service"
import type { ProviderAttachmentRecord } from "./tool-grants.contracts"
import { AccountAttachmentEntity } from "./persistence/entities"
import { ConnectionEntity } from "@modules/domain/connections/persistence/entities"

const entityOf = builder<AccountAttachmentEntity>({
    id: "access-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    connectionId: "conn-zalo",
    provider: "zalo_oa",
    updatedBy: null,
    createdAt: new Date("2026-11-10T00:00:00.000Z"),
    updatedAt: new Date("2026-11-10T00:00:00.000Z"),
})

const recordOf = builder<ProviderAttachmentRecord>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    connectionId: "conn-zalo",
    provider: "zalo_oa",
})

/** The agents of each workspace: agent-1 of ws-1. */
const OWNED: ReadonlySet<string> = new Set(["ws-1:agent-1"])

const build = async (entityManager: MockEntityManager) => {
    const agents = mock<AgentDirectoryService>({
        cardsOf: jest.fn((workspaceId: string, ids: ReadonlyArray<string>) =>
            Promise.resolve(
                ids
                    .filter((id) => OWNED.has(`${workspaceId}:${id}`))
                    .map((id) => ({ id, name: id, module: "sales" })),
            ),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountAttachmentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return moduleRef.get(AccountAttachmentsService)
}

describe("AccountAttachmentsService", () => {
    it("reads the attachments of one agent and of a workspace: the agent, the account and its provider, nothing more", async () => {
        const sepay = entityOf({ connectionId: "conn-sepay", provider: "sepay" })
        const live = [Object.assign(new ConnectionEntity(), { id: "conn-zalo" }), Object.assign(new ConnectionEntity(), { id: "conn-sepay" })]
        const entityManager = mockEntityManager({
            find: [
                [AccountAttachmentEntity, [entityOf(), sepay]],
                [ConnectionEntity, live],
            ],
        })
        const service = await build(entityManager)

        const views = [
            { agentId: "agent-1", connectionId: "conn-zalo", provider: "zalo_oa" },
            { agentId: "agent-1", connectionId: "conn-sepay", provider: "sepay" },
        ]
        await expect(service.listOfAgent("ws-1", "agent-1")).resolves.toEqual(views)
        await expect(service.listOfWorkspace("ws-1")).resolves.toEqual(views)
        expect(entityManager.find).toHaveBeenNthCalledWith(1, AccountAttachmentEntity, {
            where: { workspaceId: "ws-1", agentId: "agent-1" },
            order: { provider: "ASC", connectionId: "ASC" },
            take: 500,
        })
    })

    it("leaves out an attachment to a REMOVED account (R36 soft delete): the agent holds no right on it", async () => {
        const removed = entityOf({ connectionId: "conn-removed", provider: "sepay" })
        const entityManager = mockEntityManager({
            find: [
                [AccountAttachmentEntity, [entityOf(), removed]],
                [ConnectionEntity, [Object.assign(new ConnectionEntity(), { id: "conn-zalo" })]],
            ],
        })
        const service = await build(entityManager)

        await expect(service.listOfAgent("ws-1", "agent-1")).resolves.toEqual([
            { agentId: "agent-1", connectionId: "conn-zalo", provider: "zalo_oa" },
        ])
        expect(entityManager.find).toHaveBeenCalledWith(ConnectionEntity, {
            select: { id: true },
            where: { workspaceId: "ws-1", id: expect.anything() },
        })
    })

    it("attaches an agent of the workspace once: an attachment it holds is left as it is, a stranger gets nothing", async () => {
        const entityManager = mockEntityManager({ insert: [AccountAttachmentEntity, {}] })
        entityManager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(entityOf())
        const service = await build(entityManager)

        await expect(service.attach(recordOf(), "owner-1")).resolves.toBe("attached")
        await expect(service.attach(recordOf(), "owner-1")).resolves.toBe("held")
        await expect(service.attach(recordOf({ agentId: "agent-9" }), "owner-1")).resolves.toBe("unknown_agent")

        expect(entityManager.insert).toHaveBeenCalledTimes(1)
        expect(entityManager.insert).toHaveBeenCalledWith(AccountAttachmentEntity, { ...recordOf(), updatedBy: "owner-1" })
    })

    it("detaches by deleting the row, and says when there was none", async () => {
        const entityManager = mockEntityManager({})
        entityManager.delete.mockResolvedValueOnce({ affected: 1, raw: [] }).mockResolvedValueOnce({ affected: 0, raw: [] })
        const service = await build(entityManager)

        await expect(service.detach("ws-1", "agent-1", "conn-zalo")).resolves.toBe(true)
        await expect(service.detach("ws-1", "agent-1", "conn-zalo")).resolves.toBe(false)
        expect(entityManager.delete).toHaveBeenCalledWith(AccountAttachmentEntity, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            connectionId: "conn-zalo",
        })
    })

    it("creates only the attachments that do not exist yet, of agents of their workspace, and never touches one that is held", async () => {
        const entityManager = mockEntityManager({
            find: [AccountAttachmentEntity, [entityOf({ connectionId: "conn-zalo" })]],
            insert: [AccountAttachmentEntity, {}],
        })
        const service = await build(entityManager)

        await expect(
            service.insertMissing([
                recordOf({ connectionId: "conn-zalo" }),
                recordOf({ connectionId: "conn-zalo-2" }),
                recordOf({ connectionId: "conn-zalo-2" }),
                recordOf({ agentId: "agent-9", connectionId: "conn-x" }),
            ]),
        ).resolves.toEqual([recordOf({ connectionId: "conn-zalo-2" })])
        expect(entityManager.insert).toHaveBeenCalledWith(AccountAttachmentEntity, [
            { ...recordOf({ connectionId: "conn-zalo-2" }), updatedBy: null },
        ])
        expect(entityManager.update).not.toHaveBeenCalled()
        await expect(service.insertMissing([recordOf({ agentId: "agent-9" })])).resolves.toEqual([])
    })
})

describe("AccountAttachmentsService detachAgent", () => {
    it("deletes every attachment of the agent in the workspace and answers how many went", async () => {
        const entityManager = mockEntityManager({})
        entityManager.delete.mockResolvedValue({ affected: 2, raw: [] })
        const service = await build(entityManager)

        await expect(service.detachAgent("ws-1", "agent-1")).resolves.toBe(2)
        expect(entityManager.delete).toHaveBeenCalledWith(AccountAttachmentEntity, { workspaceId: "ws-1", agentId: "agent-1" })
    })
})
