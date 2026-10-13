import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentConversationsService } from "./agent-conversations.service"
import { AgentConversationsErrorCode } from "./errors/agent-conversations.error"
import {
    ARCHIVE_CONVERSATION,
    FIND_CONVERSATION,
    FIND_CONVERSATION_TARGET,
    FIND_TURN_CONVERSATION,
    INSERT_CONVERSATION,
    REBIND_CONVERSATION_AGENT,
    UPDATE_VISITOR_NAME,
} from "./persistence/agent-conversations.sql"

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
        const input = { workspaceId: "ws-1", agentId: "agent-1", channel: "telegram", customerId: "555", visitor: "Minh", connectionId: "c-1" }

        it("opens the conversation in the given transaction and answers it", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [INSERT_CONVERSATION, [refRow]] })

            await expect(service.open(input, inside)).resolves.toMatchObject({ id: "conv-1" })
            expect(inside.query).toHaveBeenCalledWith(INSERT_CONVERSATION, ["ws-1", "agent-1", "telegram", "555", "Minh", "c-1"])
        })

        it("fails loudly when the insert answers no row", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [INSERT_CONVERSATION, []] })

            await expect(service.open(input, inside)).rejects.toMatchObject({ code: AgentConversationsErrorCode.NotStored })
        })
    })

    describe("writes", () => {
        it("archives and rebinds through the given transaction", async () => {
            const { service } = await build()
            const inside = mockEntityManager({ query: [[ARCHIVE_CONVERSATION, []], [REBIND_CONVERSATION_AGENT, []]] })

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
                value: { id: "conv-1", workspaceId: "ws-1", channel: "telegram", externalId: "555", connectionId: "c-1" },
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
