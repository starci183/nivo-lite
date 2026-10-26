import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MessagesErrorCode } from "./errors/messages.error"
import { MessagesLogEvent } from "./messages.log-events"
import type { DepartmentCardPost, OfficeCardPost } from "./office-cards.contracts"
import { OfficeCardsService } from "./office-cards.service"
import { AGENT_DIRECTORY } from "./office-lines.decorators"
import type { OptionalAgentIdentity } from "./office-lines.contracts"
import type { AgentDirectory } from "./office-lines.port"
import { INSERT_CARD_MESSAGE } from "./persistence/office-lines.sql"

const card = { v: 1, type: "action_done", title: "Order placed: done" }

const line = (patch: Partial<OfficeCardPost> = {}): OfficeCardPost => ({
    room: null,
    agentId: "agent-1",
    authorName: "AI Sales",
    body: "  Held  ",
    leadId: "lead-1",
    workItemId: "wi-1",
    card,
    ...patch,
})

const departmentLine = (patch: Partial<DepartmentCardPost> = {}): DepartmentCardPost => ({
    room: "sales",
    body: "  Held  ",
    leadId: null,
    workItemId: "wi-1",
    card,
    ...patch,
})

const build = async (entityManager: MockEntityManager, departmentAgent: OptionalAgentIdentity = null) => {
    const logger = mock<Logger>()
    const activity = mock<ChatActivityService>()
    const agents = mock<AgentDirectory>({ agentOfDepartment: jest.fn().mockResolvedValue(departmentAgent) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeCardsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AGENT_DIRECTORY, useValue: agents },
            { provide: LOGGER, useValue: logger },
            { provide: ChatActivityService, useValue: activity },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeCardsService), logger, agents, activity }
}

describe("OfficeCardsService", () => {
    it("stores a card through its caller's transaction without using the primary manager", async () => {
        const primary = mockEntityManager()
        const manager = mockEntityManager({ query: [INSERT_CARD_MESSAGE, [{ id: "m-1", room: "sales" }]] })
        const { service, activity } = await build(primary)

        await expect(service.post({ workspaceId: "ws-1" }, line(), manager)).resolves.toEqual({
            id: "m-1",
            room: "sales",
        })

        expect(activity.message.mock.calls).toEqual([["ws-1", "room:sales", null, manager]])

        expect(manager.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, expect.any(Array))
        expect(primary.query).not.toHaveBeenCalled()
    })

    it("stores a valid card as the agent's line and answers where it landed", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, [{ id: "m-1", room: "sales" }]] })
        const { service, activity } = await build(em)

        await expect(service.post({ workspaceId: "ws-1" }, line())).resolves.toEqual({ id: "m-1", room: "sales" })

        expect(activity.message.mock.calls).toEqual([["ws-1", "room:sales", null, em]])

        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "agent",
            "AI Sales",
            "agent-1",
            "Held",
            "lead-1",
            "wi-1",
            null,
            JSON.stringify(card),
        ])
    })

    it("posts a NIVO line in the named room and falls back to the title for an empty preview", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, []] })
        const { service, activity } = await build(em)

        const posted = await service.post(
            { workspaceId: "ws-1" },
            line({ agentId: null, authorName: "NIVO", body: " ", room: "accounting" }),
        )

        expect(posted).toEqual({ id: "", room: "accounting" })
        expect(activity.message.mock.calls).toEqual([["ws-1", "room:accounting", null, em]])
        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "system",
            "NIVO",
            null,
            card.title,
            "lead-1",
            "wi-1",
            "accounting",
            JSON.stringify(card),
        ])
    })

    it("refuses a card that breaks the contract and writes nothing", async () => {
        const em = mockEntityManager()
        const { service, activity } = await build(em)

        await expect(service.post({ workspaceId: "ws-1" }, line({ card: { v: 1 } }))).rejects.toMatchObject({
            code: MessagesErrorCode.CardInvalid,
            params: { reason: "type is not a card type" },
        })
        expect(em.query).not.toHaveBeenCalled()
        expect(activity.message).not.toHaveBeenCalled()
    })
})

describe("OfficeCardsService.postAsDepartment", () => {
    it("posts a valid card as the department's agent", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, [{ id: "m-2", room: "sales" }]] })
        const { service, logger, agents, activity } = await build(em, { id: "agent-9", name: "AI Sales" })

        await expect(service.postAsDepartment({ workspaceId: "ws-1" }, "sales", departmentLine())).resolves.toEqual({
            id: "m-2",
            room: "sales",
        })

        expect(activity.message.mock.calls).toEqual([["ws-1", "room:sales", null, em]])

        expect(agents.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "agent",
            "AI Sales",
            "agent-9",
            "Held",
            null,
            "wi-1",
            "sales",
            JSON.stringify(card),
        ])
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("logs a refused card and still posts its preview line spoken by the department's agent", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, [{ id: "m-3", room: "sales" }]] })
        const { service, logger, activity } = await build(em, { id: "agent-9", name: "AI Sales" })

        const posted = await service.postAsDepartment(
            { workspaceId: "ws-1" },
            "sales",
            departmentLine({ card: { v: 1 } }),
        )

        expect(posted).toEqual({ id: "m-3", room: "sales" })
        expect(activity.message.mock.calls).toEqual([["ws-1", "room:sales", null, em]])
        expect(logger.warn).toHaveBeenCalledWith(MessagesLogEvent.CardRefused, {
            workspaceId: "ws-1",
            department: "sales",
            reason: "type is not a card type",
        })
        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "agent",
            "AI Sales",
            "agent-9",
            "Held",
            null,
            "wi-1",
            "sales",
            null,
        ])
    })
})

describe("OfficeCardsService.postAsDepartment without an agent", () => {
    it("speaks a refused card as NIVO, previews the department name and answers the room when nothing comes back", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, []] })
        const { service, logger, activity } = await build(em)

        const posted = await service.postAsDepartment(
            { workspaceId: "ws-1" },
            "accounting",
            departmentLine({ body: " ", room: null, card: null }),
        )

        expect(posted).toEqual({ id: "", room: null })
        expect(activity.message.mock.calls).toEqual([["ws-1", "room:office", null, em]])
        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "system",
            "NIVO",
            null,
            "accounting",
            null,
            "wi-1",
            null,
            null,
        ])
    })
})
