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

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

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

describe("OfficeLinesService > speakers", () => {
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
})

describe("OfficeLinesService > a named agent in a room", () => {
    it("speaks as the agent it names, in the room it names, and tells that room", async () => {
        const em = mockEntityManager({ insert: [MessageEntity, {}] })
        const { service, directory, activity } = await build(em, null)
        directory.agentById.mockResolvedValue({ id: "agent-9", name: "Ke Toan" })

        await service.post(ctx, lineOf({ agent_id: "agent-9", room: "accounting", lead_id: null, work_item_id: null }))

        expect(directory.agentById).toHaveBeenCalledWith("ws-1", "agent-9")
        expect(directory.agentOfDepartment).not.toHaveBeenCalled()
        expect(activity.message.mock.calls).toEqual([["ws-1", "room:accounting", null, em]])
        expect(em.insert.mock.calls).toEqual([
            [
                MessageEntity,
                plain({
                    workspaceId: "ws-1",
                    authorKind: "agent",
                    authorName: "Ke Toan",
                    agentId: "agent-9",
                    body: "Followed up",
                    leadId: null,
                    workItemId: null,
                    room: "accounting",
                }),
            ],
        ])
    })

    it("posts nothing when the same agent already said the same words since the wake", async () => {
        const em = mockEntityManager({ exists: [MessageEntity, true] })
        const { service, directory, activity } = await build(em, null)
        directory.agentById.mockResolvedValue({ id: "agent-9", name: "Ke Toan" })

        await service.post(ctx, lineOf({ agent_id: "agent-9", unlessSaidSince: new Date("2026-10-31T10:00:00Z") }))

        expect(em.insert).not.toHaveBeenCalled()
        expect(activity.message).not.toHaveBeenCalled()
        expect(em.exists).toHaveBeenCalledWith(
            MessageEntity,
            objectLike({ where: objectLike({ body: "Followed up", authorKind: "agent" }) }),
        )
    })

    it("posts the line when nobody said it since the wake", async () => {
        const em = mockEntityManager({ exists: [MessageEntity, false], insert: [MessageEntity, {}] })
        const { service, directory } = await build(em, null)
        directory.agentById.mockResolvedValue({ id: "agent-9", name: "Ke Toan" })

        await service.post(ctx, lineOf({ agent_id: "agent-9", unlessSaidSince: new Date("2026-10-31T10:00:00Z") }))

        expect(em.insert).toHaveBeenCalledTimes(1)
    })

    it("tells a system line from an agent line when it checks a NIVO line was said", async () => {
        const em = mockEntityManager({ exists: [MessageEntity, true] })
        const { service } = await build(em, null)

        await service.post(ctx, lineOf({ unlessSaidSince: new Date("2026-10-31T10:00:00Z") }))

        expect(em.exists).toHaveBeenCalledWith(
            MessageEntity,
            objectLike({ where: objectLike({ authorKind: "system" }) }),
        )
        expect(em.insert).not.toHaveBeenCalled()
    })
})

describe("OfficeLinesService > without an agent", () => {
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
