import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { LEAD_GEN_ACTOR, LeadFlowConversationService } from "./lead-flow-conversation.service"
import type { FlowConversationTarget } from "./lead-flow-conversation.service"

const PROFILE: AgentProfile = {
    id: "agent-1",
    name: "Linh",
    handle: "linh",
    role: "Lead gen",
    instructions: "",
    knowledge: "",
    approval_rule: "",
}

const REF: ConversationRef = { id: "conv-1", agentId: "agent-1", leadId: null, handledBy: null, visitorName: "Lan" }

const TARGET: FlowConversationTarget = {
    workspaceId: "ws-1",
    flow: { platform: "facebook", connection_id: "connection-1", lead_id: "lead-1", name: "Lan" },
    externalId: "person-1",
    agentId: "agent-1",
}

const build = async () => {
    const entityManager = mockEntityManager()
    const bindings = mock<AgentBindingsService>()
    const agents = mock<AgentsService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowConversationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentsService, useValue: agents },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
        ],
    }).compile()
    return {
        service: moduleRef.get(LeadFlowConversationService),
        entityManager,
        bindings,
        agents,
        conversations,
        messages,
    }
}

describe("LeadFlowConversationService", () => {
    it("takes the lead_gen agent bound to the connection, else the workspace's lead_gen agent", async () => {
        const { service, bindings, agents } = await build()
        bindings.agentsFor.mockResolvedValue([])
        agents.profileOfDepartment.mockResolvedValue(PROFILE)

        await expect(service.leadGenAgent("ws-1", "connection-1")).resolves.toBe(PROFILE)

        expect(bindings.agentsFor).toHaveBeenCalledWith("connection-1", "lead_source", {
            acting: true,
            modules: ["lead_gen"],
        })
        expect(agents.profileOf).not.toHaveBeenCalled()
        expect(agents.profileOfDepartment).toHaveBeenCalledWith("ws-1", "lead_gen")
    })

    it("follows the current agent and the lead in a conversation that already exists", async () => {
        const { service, conversations, entityManager } = await build()
        conversations.find.mockResolvedValue(ok({ ...REF, agentId: "agent-0" }))

        await expect(service.ensure(TARGET)).resolves.toBe("conv-1")

        expect(conversations.find).toHaveBeenCalledWith("ws-1", "facebook", "connection-1", "person-1")
        expect(conversations.rebind).toHaveBeenCalledWith("conv-1", "agent-1", entityManager)
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-1")
        expect(conversations.open).not.toHaveBeenCalled()
    })

    it("opens the conversation on first contact, and opens none without a connection", async () => {
        const { service, conversations, entityManager } = await build()
        conversations.find.mockResolvedValue(refused(AgentConversationsErrorCode.NotFound))
        conversations.open.mockResolvedValue({ ...REF, id: "conv-2" })

        await expect(service.ensure(TARGET)).resolves.toBe("conv-2")
        await expect(service.ensure({ ...TARGET, flow: { ...TARGET.flow, connection_id: null } })).resolves.toBeNull()

        expect(conversations.open.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    channel: "facebook",
                    customerId: "person-1",
                    visitor: "Lan",
                    connectionId: "connection-1",
                },
                entityManager,
            ],
        ])
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-2", "lead-1")
    })

    it("stores each kind of transcript line with its delivery, and nothing for an empty one", async () => {
        const { service, messages, entityManager } = await build()
        messages.storeAgentMessage.mockResolvedValue("message-1")
        const line = { workspaceId: "ws-1", conversationId: "conv-1", delivery: null }

        await service.say({ ...line, role: "user", body: "Hello" })
        await service.say({ ...line, role: "system", body: "A person takes over" })
        await service.say({ ...line, role: "agent", body: "Hi!", delivery: { sent: false, error: "meta_token" } })
        await service.say({ ...line, role: "agent", body: "  " })

        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", entityManager)
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "A person takes over")
        expect(messages.storeAgentMessage).toHaveBeenCalledTimes(1)
        expect(messages.markDelivery).toHaveBeenCalledWith("message-1", false, "meta_token")
    })

    it("tells whether a person holds an escalated flow and hands a conversation to a person", async () => {
        const { service, conversations } = await build()
        conversations.turnOf.mockResolvedValue(
            ok({
                id: "conv-1",
                workspaceId: "ws-1",
                channel: "facebook",
                externalId: "person-1",
                connectionId: "connection-1",
                leadId: "lead-1",
                handledBy: "Mai",
                visitorName: "Lan",
                installationId: null,
                agent: {
                    id: "agent-1",
                    name: "Linh",
                    handle: "linh",
                    role: "Lead gen",
                    module: "lead_gen",
                    instructions: "",
                    knowledge: "",
                    approvalRule: "",
                    greeting: "",
                },
            }),
        )

        await expect(service.heldByPerson({ state: "qualifying", conversation_id: "conv-1" })).resolves.toBe(false)
        await expect(service.heldByPerson({ state: "escalated", conversation_id: null })).resolves.toBe(true)
        await expect(service.heldByPerson({ state: "escalated", conversation_id: "conv-1" })).resolves.toBe(true)
        await service.handToPerson("ws-1", "conv-1")

        expect(conversations.turnOf).toHaveBeenCalledTimes(1)
        expect(conversations.handToPerson).toHaveBeenCalledWith("ws-1", "conv-1", LEAD_GEN_ACTOR)
    })
})
