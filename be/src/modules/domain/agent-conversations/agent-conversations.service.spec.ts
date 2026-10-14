import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentConversationsService } from "./agent-conversations.service"
import { AgentConversationsErrorCode } from "./errors/agent-conversations.error"
import {
    ARCHIVE_CONVERSATION,
    ATTACH_CONVERSATION_LEAD,
    FIND_CONVERSATION,
    FIND_CONVERSATION_TARGET,
    FIND_LATEST_LEAD_CONVERSATION,
    FIND_TURN_CONVERSATION,
    HAND_CONVERSATION_TO_PERSON,
    INSERT_CHAT_CONVERSATION,
    INSERT_CONVERSATION,
    LIST_CHAT_CONVERSATIONS,
    LOCK_CHAT_CONVERSATION,
    LOCK_HUMAN_CONVERSATION,
    REBIND_CONVERSATION_AGENT,
    SET_CHAT_HOLDER,
    SET_HUMAN_HANDLING,
    UPDATE_VISITOR_NAME,
} from "./persistence/agent-conversations.sql"
import { LIST_CUSTOMER_LEAD_CONVERSATIONS } from "./persistence/customer-conversations.sql"

const refRow = { id: "conv-1", agent_id: "agent-1", lead_id: null, handled_by: null, visitor_name: "Minh" }
const targetRow = { id: "conv-1", workspace_id: "ws-1", channel: "telegram", external_id: "555", connection_id: "c-1" }
const turnRow = {
    ...targetRow,
    lead_id: "lead-1",
    handled_by: "Lan",
    visitor_name: "Minh",
    installation_id: "inst-1",
    agent_id: "agent-1",
    agent_name: "Chatbot",
    agent_handle: "chatbot",
    agent_role: "Customer chat",
    agent_module: "chatbot",
    agent_instructions: "Be kind",
    agent_knowledge: "Tea",
    agent_approval_rule: "ask",
    agent_greeting: "Hi",
}

const build = async (answers: Record<string, ReadonlyArray<unknown>> = {}) => {
    const em = mockEntityManager({
        query: Object.entries({
            [FIND_CONVERSATION]: [refRow],
            [INSERT_CONVERSATION]: [refRow],
            [ARCHIVE_CONVERSATION]: [],
            [REBIND_CONVERSATION_AGENT]: [],
            [UPDATE_VISITOR_NAME]: [],
            [FIND_CONVERSATION_TARGET]: [targetRow],
            [FIND_TURN_CONVERSATION]: [turnRow],
            ...answers,
        }).map(([text, rows]): [string, unknown] => [text, rows]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentConversationsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentConversationsService), em }
}

describe("AgentConversationsService", () => {
    describe("chat", () => {
        const chatRow = {
            id: "chat-1",
            kind: "customer",
            channel: "website",
            visitor_name: "Minh",
            lead_id: "lead-1",
            handled_by: "Lan",
            created_at: "2026-10-13T09:00:00+07:00",
        }
        const chat = {
            id: "chat-1",
            kind: "customer",
            channel: "website",
            visitorName: "Minh",
            leadId: "lead-1",
            handledBy: "Lan",
            createdAt: "2026-10-13T02:00:00.000Z",
        }

        it("maps customer and test history, including nullable visitor and handling fields", async () => {
            const { service, em } = await build({
                [LIST_CHAT_CONVERSATIONS]: [
                    chatRow,
                    { ...chatRow, id: "chat-2", kind: "test", visitor_name: null, lead_id: null, handled_by: null },
                ],
            })

            await expect(service.listChat("ws-1", "agent-1")).resolves.toEqual([
                chat,
                { ...chat, id: "chat-2", kind: "test", visitorName: null, leadId: null, handledBy: null },
            ])
            expect(em.query).toHaveBeenCalledWith(LIST_CHAT_CONVERSATIONS, ["ws-1", "agent-1"])
        })

        it("opens the chat through the supplied transaction and maps its returned row", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({ query: [INSERT_CHAT_CONVERSATION, [chatRow]] })

            await expect(
                service.openChat(
                    { workspaceId: "ws-1", agentId: "agent-1", kind: "customer", visitorName: "Minh" },
                    inside,
                ),
            ).resolves.toEqual(chat)
            expect(inside.query).toHaveBeenCalledWith(INSERT_CHAT_CONVERSATION, ["ws-1", "agent-1", "customer", "Minh"])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses a chat insert that returned no row", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [INSERT_CHAT_CONVERSATION, []] })

            await expect(
                service.openChat({ workspaceId: "ws-1", agentId: "agent-1", kind: "test", visitorName: null }, inside),
            ).rejects.toMatchObject({ code: AgentConversationsErrorCode.NotStored })
            expect(inside.query).toHaveBeenCalledWith(INSERT_CHAT_CONVERSATION, ["ws-1", "agent-1", "test", null])
        })

        it("locks a scoped chat through the supplied transaction", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({ query: [LOCK_CHAT_CONVERSATION, [chatRow]] })

            await expect(service.lockChat("ws-1", "chat-1", inside)).resolves.toEqual(chat)
            expect(inside.query).toHaveBeenCalledWith(LOCK_CHAT_CONVERSATION, ["ws-1", "chat-1"])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses to lock a chat that is absent from the workspace", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [LOCK_CHAT_CONVERSATION, []] })

            await expect(service.lockChat("ws-1", "chat-1", inside)).rejects.toMatchObject({
                code: AgentConversationsErrorCode.NotFound,
            })
            expect(inside.query).toHaveBeenCalledWith(LOCK_CHAT_CONVERSATION, ["ws-1", "chat-1"])
        })

        it("sets and clears the chat holder through the supplied transaction", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({ query: [SET_CHAT_HOLDER, []] })

            await expect(service.setChatHolder("ws-1", "chat-1", "Lan", inside)).resolves.toBeUndefined()
            await expect(service.setChatHolder("ws-1", "chat-1", null, inside)).resolves.toBeUndefined()
            expect(inside.query).toHaveBeenNthCalledWith(1, SET_CHAT_HOLDER, ["ws-1", "chat-1", "Lan"])
            expect(inside.query).toHaveBeenNthCalledWith(2, SET_CHAT_HOLDER, ["ws-1", "chat-1", null])
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("customer leads", () => {
        it("lists customer lead conversations using the default or requested bound", async () => {
            const rows = [{ id: "conv-1", lead_id: "lead-1", handled_by: "Lan" }]
            const { service, em } = await build({ [LIST_CUSTOMER_LEAD_CONVERSATIONS]: rows })

            await expect(service.listCustomerLeadConversations("ws-1")).resolves.toEqual(rows)
            await expect(service.listCustomerLeadConversations("ws-1", 12)).resolves.toEqual(rows)
            expect(em.query).toHaveBeenNthCalledWith(1, LIST_CUSTOMER_LEAD_CONVERSATIONS, ["ws-1", 200])
            expect(em.query).toHaveBeenNthCalledWith(2, LIST_CUSTOMER_LEAD_CONVERSATIONS, ["ws-1", 12])
        })

        it("maps the newest lead conversation while forwarding its optional channel", async () => {
            const { service, em } = await build({
                [FIND_LATEST_LEAD_CONVERSATION]: [
                    { id: "conv-1", agent_id: "agent-1", channel: "telegram", visitor_name: null },
                ],
            })
            const expected = { id: "conv-1", agentId: "agent-1", channel: "telegram", visitorName: null }

            await expect(service.latestOfLead("ws-1", "lead-1", null)).resolves.toEqual(expected)
            await expect(service.latestOfLead("ws-1", "lead-1", "telegram")).resolves.toEqual(expected)
            expect(em.query).toHaveBeenNthCalledWith(1, FIND_LATEST_LEAD_CONVERSATION, ["ws-1", "lead-1", null])
            expect(em.query).toHaveBeenNthCalledWith(2, FIND_LATEST_LEAD_CONVERSATION, ["ws-1", "lead-1", "telegram"])
        })

        it("answers null when the lead has no matching conversation", async () => {
            const { service, em } = await build({ [FIND_LATEST_LEAD_CONVERSATION]: [] })

            await expect(service.latestOfLead("ws-1", "lead-1", "zalo")).resolves.toBeNull()
            expect(em.query).toHaveBeenCalledWith(FIND_LATEST_LEAD_CONVERSATION, ["ws-1", "lead-1", "zalo"])
        })
    })

    describe("human handling", () => {
        it("maps the locked customer conversation and its current holder", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({
                query: [LOCK_HUMAN_CONVERSATION, [{ ...targetRow, lead_id: "lead-1", handled_by: "Lan" }]],
            })

            await expect(service.lockForHuman("ws-1", "conv-1", inside)).resolves.toEqual({
                id: "conv-1",
                workspaceId: "ws-1",
                channel: "telegram",
                externalId: "555",
                connectionId: "c-1",
                leadId: "lead-1",
                handledBy: "Lan",
            })
            expect(inside.query).toHaveBeenCalledWith(LOCK_HUMAN_CONVERSATION, ["ws-1", "conv-1"])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("answers null when no scoped customer conversation can be locked", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [LOCK_HUMAN_CONVERSATION, []] })

            await expect(service.lockForHuman("ws-1", "conv-1", inside)).resolves.toBeNull()
            expect(inside.query).toHaveBeenCalledWith(LOCK_HUMAN_CONVERSATION, ["ws-1", "conv-1"])
        })

        it("persists a handover and captured lead in the primary manager", async () => {
            const { service, em } = await build({
                [HAND_CONVERSATION_TO_PERSON]: [],
                [ATTACH_CONVERSATION_LEAD]: [],
            })

            await expect(service.handToPerson("ws-1", "conv-1", "Lan")).resolves.toBeUndefined()
            await expect(service.attachLead("ws-1", "conv-1", "lead-1")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenNthCalledWith(1, HAND_CONVERSATION_TO_PERSON, ["ws-1", "conv-1", "Lan"])
            expect(em.query).toHaveBeenNthCalledWith(2, ATTACH_CONVERSATION_LEAD, ["ws-1", "conv-1", "lead-1"])
        })

        it("updates human handling using the manager that locked the conversation", async () => {
            const { service, em } = await build()
            const inside = mockEntityManager({ query: [SET_HUMAN_HANDLING, []] })

            await expect(service.setHumanHandling("ws-1", "conv-1", "Lan", inside)).resolves.toBeUndefined()
            await expect(service.setHumanHandling("ws-1", "conv-1", null, inside)).resolves.toBeUndefined()
            expect(inside.query).toHaveBeenNthCalledWith(1, SET_HUMAN_HANDLING, ["ws-1", "conv-1", "Lan"])
            expect(inside.query).toHaveBeenNthCalledWith(2, SET_HUMAN_HANDLING, ["ws-1", "conv-1", null])
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("find", () => {
        it("answers the conversation of a customer on a connection", async () => {
            const { service, em } = await build()

            await expect(service.find("ws-1", "telegram", "c-1", "555")).resolves.toEqual({
                kind: "ok",
                value: { id: "conv-1", agentId: "agent-1", leadId: null, handledBy: null, visitorName: "Minh" },
            })
            expect(em.query).toHaveBeenCalledWith(FIND_CONVERSATION, ["ws-1", "telegram", "c-1", "555"])
        })

        it("refuses when the customer never wrote, and reads through the manager it is given", async () => {
            const { service } = await build({ [FIND_CONVERSATION]: [] })
            const inside = mockEntityManager({ query: [FIND_CONVERSATION, [refRow]] })

            await expect(service.find("ws-1", "telegram", "c-1", "555")).resolves.toMatchObject({
                kind: "refused",
                code: AgentConversationsErrorCode.NotFound,
            })
            await expect(service.find("ws-1", "telegram", "c-1", "555", inside)).resolves.toMatchObject({ kind: "ok" })
        })
    })

    describe("open", () => {
        const input = {
            workspaceId: "ws-1",
            agentId: "agent-1",
            channel: "telegram",
            customerId: "555",
            visitor: "Minh",
            connectionId: "c-1",
        }

        it("opens the conversation in the given transaction and answers it", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [INSERT_CONVERSATION, [refRow]] })

            await expect(service.open(input, inside)).resolves.toMatchObject({ id: "conv-1" })
            expect(inside.query).toHaveBeenCalledWith(INSERT_CONVERSATION, [
                "ws-1",
                "agent-1",
                "telegram",
                "555",
                "Minh",
                "c-1",
            ])
        })

        it("fails loudly when the insert answers no row", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [INSERT_CONVERSATION, []] })

            await expect(service.open(input, inside)).rejects.toMatchObject({
                code: AgentConversationsErrorCode.NotStored,
            })
        })
    })

    describe("writes", () => {
        it("archives and rebinds through the given transaction", async () => {
            const { service } = await build()
            const inside = mockEntityManager({
                query: [
                    [ARCHIVE_CONVERSATION, []],
                    [REBIND_CONVERSATION_AGENT, []],
                ],
            })

            await service.archive("ws-1", "telegram", "c-1", "555", "555:1", inside)
            await service.rebind("conv-1", "agent-2", inside)

            expect(inside.query).toHaveBeenCalledWith(ARCHIVE_CONVERSATION, ["ws-1", "telegram", "c-1", "555", "555:1"])
            expect(inside.query).toHaveBeenCalledWith(REBIND_CONVERSATION_AGENT, ["conv-1", "agent-2"])
        })

        it("renames the customer", async () => {
            const { service, em } = await build()

            await service.rename("conv-1", "Minh Tran")

            expect(em.query).toHaveBeenCalledWith(UPDATE_VISITOR_NAME, ["conv-1", "Minh Tran"])
        })
    })

    describe("targetOf", () => {
        it("answers where the replies go, or a refusal for a conversation that does not exist", async () => {
            const found = await build()
            const missing = await build({ [FIND_CONVERSATION_TARGET]: [] })

            await expect(found.service.targetOf("conv-1")).resolves.toEqual({
                kind: "ok",
                value: {
                    id: "conv-1",
                    workspaceId: "ws-1",
                    channel: "telegram",
                    externalId: "555",
                    connectionId: "c-1",
                },
            })
            await expect(missing.service.targetOf("conv-1")).resolves.toMatchObject({
                kind: "refused",
                code: AgentConversationsErrorCode.NotFound,
            })
        })
    })

    describe("turnOf", () => {
        it("answers the conversation with the agent that speaks in it", async () => {
            const { service } = await build()

            await expect(service.turnOf("conv-1")).resolves.toEqual({
                kind: "ok",
                value: {
                    id: "conv-1",
                    workspaceId: "ws-1",
                    channel: "telegram",
                    externalId: "555",
                    connectionId: "c-1",
                    leadId: "lead-1",
                    handledBy: "Lan",
                    visitorName: "Minh",
                    installationId: "inst-1",
                    agent: {
                        id: "agent-1",
                        name: "Chatbot",
                        handle: "chatbot",
                        role: "Customer chat",
                        module: "chatbot",
                        instructions: "Be kind",
                        knowledge: "Tea",
                        approvalRule: "ask",
                        greeting: "Hi",
                    },
                },
            })
        })

        it("refuses a conversation that does not exist", async () => {
            const { service } = await build({ [FIND_TURN_CONVERSATION]: [] })

            await expect(service.turnOf("conv-1")).resolves.toMatchObject({
                kind: "refused",
                code: AgentConversationsErrorCode.NotFound,
            })
        })
    })
})
