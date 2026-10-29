import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessagesScope, OfficeLineInput, OptionalAgentIdentity } from "./office-lines.contracts"
import { AGENT_DIRECTORY } from "./office-lines.decorators"
import type { AgentDirectory } from "./office-lines.port"
import { OfficeLinesService } from "./office-lines.service"
import { MessageEntity } from "./persistence/entities"

/** Hands a literal to an expectation as a plain object, so it is not mistaken for a hand-built entity row. */
const plain = (value: object): object => value

const ctx: MessagesScope = { workspaceId: "ws-1" }

const lineOf = builder<OfficeLineInput>({ body: "Followed up", lead_id: "lead-1", work_item_id: "item-1" })

const build = async (entityManager: MockEntityManager, agent: OptionalAgentIdentity) => {
    const directory = mock<AgentDirectory>({ agentOfDepartment: jest.fn().mockResolvedValue(agent) })
    const activity = mock<ChatActivityService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeLinesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AGENT_DIRECTORY, useValue: directory },
            { provide: ChatActivityService, useValue: activity },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeLinesService), directory, activity }
}

describe("OfficeLinesService", () => {
    it("keeps the command mirror in the caller's transaction", async () => {
        const primary = mockEntityManager()
        const tx = mockEntityManager({ insert: [MessageEntity, {}] })
        const { service, directory, activity } = await build(primary, null)

        await service.post(ctx, lineOf({ command: true }), tx)

        expect(activity.message.mock.calls).toEqual([["ws-1", "room:office", null, tx]])

        expect(primary.insert).not.toHaveBeenCalled()
        expect(directory.agentOfDepartment).not.toHaveBeenCalled()
        expect(tx.insert.mock.calls).toEqual([
            [
                MessageEntity,
                plain({
                    workspaceId: "ws-1",
                    authorKind: "system",
                    authorName: "NIVO Bus",
                    agentId: null,
                    body: "Followed up",
                    leadId: "lead-1",
                    workItemId: "item-1",
                }),
            ],
        ])
    })

    it("speaks as the department's agent when it is installed", async () => {
        const em = mockEntityManager({ insert: [MessageEntity, {}] })
        const { service, directory, activity } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.post(ctx, lineOf({ dept: "sales", installation_id: "inst-1" }))).resolves.toBeUndefined()

        expect(activity.message.mock.calls).toEqual([["ws-1", "room:office", null, em]])

        expect(directory.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", "inst-1")
        expect(em.insert.mock.calls).toEqual([
            [
                MessageEntity,
                plain({
                    workspaceId: "ws-1",
                    authorKind: "agent",
                    authorName: "Sales Agent",
                    agentId: "agent-1",
                    body: "Followed up",
                    leadId: "lead-1",
                    workItemId: "item-1",
                }),
            ],
        ])
    })

    it("asks for the department's first agent when no instance is named", async () => {
        const { service, directory } = await build(mockEntityManager({ insert: [MessageEntity, {}] }), null)

        await expect(service.post(ctx, lineOf({ dept: "sales" }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
    })

    it("stays a NIVO line when the department has no agent", async () => {
        const em = mockEntityManager({ insert: [MessageEntity, {}] })
        const { service } = await build(em, null)

        await expect(service.post(ctx, lineOf({ dept: "sales" }))).resolves.toBeUndefined()

        expect(em.insert.mock.calls).toEqual([
            [
                MessageEntity,
                plain({
                    workspaceId: "ws-1",
                    authorKind: "system",
                    authorName: "NIVO",
                    agentId: null,
                    body: "Followed up",
                    leadId: "lead-1",
                    workItemId: "item-1",
                }),
            ],
        ])
    })

    it("stays a NIVO line when no department speaks", async () => {
        const em = mockEntityManager({ insert: [MessageEntity, {}] })
        const { service, directory } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.post(ctx, lineOf({ lead_id: null, work_item_id: null }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).not.toHaveBeenCalled()
        expect(em.insert.mock.calls).toEqual([
            [
                MessageEntity,
                plain({
                    workspaceId: "ws-1",
                    authorKind: "system",
                    authorName: "NIVO",
                    agentId: null,
                    body: "Followed up",
                    leadId: null,
                    workItemId: null,
                }),
            ],
        ])
    })

    it("posts a command mirror as the bus, never as the receiving agent", async () => {
        const em = mockEntityManager({ insert: [MessageEntity, {}] })
        const { service, directory } = await build(em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.post(ctx, lineOf({ dept: "sales", command: true }))).resolves.toBeUndefined()

        expect(directory.agentOfDepartment).not.toHaveBeenCalled()
        expect(em.insert.mock.calls).toEqual([
            [
                MessageEntity,
                plain({
                    workspaceId: "ws-1",
                    authorKind: "system",
                    authorName: "NIVO Bus",
                    agentId: null,
                    body: "Followed up",
                    leadId: "lead-1",
                    workItemId: "item-1",
                }),
            ],
        ])
    })
})
