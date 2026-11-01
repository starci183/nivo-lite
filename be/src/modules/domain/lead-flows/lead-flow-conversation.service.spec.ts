import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef, TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesErrorCode, AgentMessagesService } from "@modules/domain/agent-messages"
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

const TURN: TurnConversation = {
    ...REF,
    workspaceId: "ws-1",
    channel: "facebook",
    externalId: "person-1",
    connectionId: "connection-1",
    installationId: null,
    agent: { ...PROFILE, module: "lead_gen", approvalRule: "", greeting: "" },
    speaksAs: null,
}

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
})

describe("LeadFlowConversationService", () => {
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
})

describe("LeadFlowConversationService", () => {
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
                speaksAs: null,
            }),
        )

        await expect(service.heldByPerson({ state: "qualifying", conversation_id: "conv-1" })).resolves.toBe(false)
        await expect(service.heldByPerson({ state: "escalated", conversation_id: null })).resolves.toBe(true)
        await expect(service.heldByPerson({ state: "escalated", conversation_id: "conv-1" })).resolves.toBe(true)
        await service.handToPerson("ws-1", "conv-1")

        expect(conversations.turnOf).toHaveBeenCalledTimes(1)
        expect(conversations.handToPerson).toHaveBeenCalledWith("ws-1", "conv-1", LEAD_GEN_ACTOR)
    })
    it("uses the first bound agent's profile and falls back when it is absent or no connection is supplied", async () => {
        const { service, bindings, agents } = await build()
        bindings.agentsFor.mockResolvedValue([
            { id: "bound-1", name: "Linh", module: "lead_gen", access: "auto", purpose: "lead_source" },
            { id: "bound-2", name: "Mai", module: "lead_gen", access: "auto", purpose: "lead_source" },
        ])
        agents.profileOf.mockResolvedValueOnce(PROFILE).mockResolvedValueOnce(null)
        agents.profileOfDepartment.mockResolvedValue(PROFILE)

        await expect(service.leadGenAgent("ws-1", "connection-1")).resolves.toBe(PROFILE)
        expect(agents.profileOfDepartment).not.toHaveBeenCalled()
        await expect(service.leadGenAgent("ws-1", "connection-1")).resolves.toBe(PROFILE)
        await expect(service.leadGenAgent("ws-1", null)).resolves.toBe(PROFILE)

        expect(agents.profileOf.mock.calls).toEqual([
            ["ws-1", "bound-1"],
            ["ws-1", "bound-1"],
        ])
        expect(bindings.agentsFor).toHaveBeenCalledTimes(2)
        expect(agents.profileOfDepartment.mock.calls).toEqual([
            ["ws-1", "lead_gen"],
            ["ws-1", "lead_gen"],
        ])
    })
})

describe("LeadFlowConversationService", () => {
    it("keeps an existing agent and lead, and does not attach an absent flow lead", async () => {
        const { service, conversations } = await build()
        conversations.find.mockResolvedValueOnce(ok({ ...REF, leadId: "existing-lead" })).mockResolvedValueOnce(ok(REF))

        await expect(service.ensure(TARGET)).resolves.toBe("conv-1")
        await expect(service.ensure({ ...TARGET, flow: { ...TARGET.flow, lead_id: null } })).resolves.toBe("conv-1")

        expect(conversations.rebind).not.toHaveBeenCalled()
        expect(conversations.attachLead).not.toHaveBeenCalled()
        expect(conversations.open).not.toHaveBeenCalled()
        expect(conversations.find.mock.calls).toEqual([
            ["ws-1", "facebook", "connection-1", "person-1"],
            ["ws-1", "facebook", "connection-1", "person-1"],
        ])
    })
    it("requires a person id and defaults an unnamed new conversation to Facebook without attaching an absent lead", async () => {
        const { service, conversations, entityManager } = await build()
        conversations.find.mockResolvedValue(refused(AgentConversationsErrorCode.NotFound))
        conversations.open.mockResolvedValue(REF)

        await expect(service.ensure({ ...TARGET, externalId: "" })).resolves.toBeNull()
        expect(conversations.find).not.toHaveBeenCalled()
        await expect(
            service.ensure({ ...TARGET, flow: { ...TARGET.flow, platform: null, name: null, lead_id: null } }),
        ).resolves.toBe("conv-1")

        expect(conversations.find).toHaveBeenCalledWith("ws-1", "facebook", "connection-1", "person-1")
        expect(conversations.open).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                channel: "facebook",
                customerId: "person-1",
                visitor: "",
                connectionId: "connection-1",
            },
            entityManager,
        )
        expect(conversations.attachLead).not.toHaveBeenCalled()
    })
    it("stores an agent line without delivery and omits a null delivery error, while ignoring a missing conversation", async () => {
        const { service, messages } = await build()
        const line = { workspaceId: "ws-1", conversationId: "conv-1", role: "agent" as const, body: "Hi!" }
        messages.storeAgentMessage.mockResolvedValue("message-1")

        await service.say({ ...line, conversationId: null, delivery: null })
        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
        await service.say({ ...line, delivery: null })
        expect(messages.markDelivery).not.toHaveBeenCalled()
        await service.say({ ...line, delivery: { sent: true, error: null } })

        expect(messages.storeAgentMessage.mock.calls).toEqual([
            ["ws-1", "conv-1", "Hi!"],
            ["ws-1", "conv-1", "Hi!"],
        ])
        expect(messages.markDelivery).toHaveBeenCalledWith("message-1", true, undefined)
        expect(messages.storeCustomer).not.toHaveBeenCalled()
        expect(messages.storeLine).not.toHaveBeenCalled()
    })
})

describe("LeadFlowConversationService", () => {
    it("stores a work item under its stable id and reports sent, failed and missing delivery records", async () => {
        const { service, messages, entityManager } = await build()
        messages.storeHumanMessage.mockResolvedValue("item-1")
        messages.find
            .mockResolvedValueOnce(ok({ id: "item-1", role: "agent", body: "Hello", deliveryStatus: "sent" }))
            .mockResolvedValueOnce(ok({ id: "item-1", role: "agent", body: "Hello", deliveryStatus: "failed" }))
            .mockResolvedValueOnce(refused(AgentMessagesErrorCode.NotFound))

        await expect(service.stableLine("ws-1", "conv-1", "Hello", "Linh", "item-1")).resolves.toEqual({
            id: "item-1",
            sent: true,
        })
        await expect(service.stableLine("ws-1", "conv-1", "Hello", "Linh", "item-1")).resolves.toEqual({
            id: "item-1",
            sent: false,
        })
        await expect(service.stableLine("ws-1", "conv-1", "Hello", "Linh", "item-1")).resolves.toEqual({
            id: "item-1",
            sent: false,
        })

        expect(messages.storeHumanMessage).toHaveBeenCalledTimes(3)
        expect(messages.storeHumanMessage).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "Hello",
            "Linh",
            entityManager,
            "item-1",
        )
        expect(messages.find.mock.calls).toEqual([
            ["item-1", "conv-1"],
            ["item-1", "conv-1"],
            ["item-1", "conv-1"],
        ])
    })
    it("passes delivery failures through and omits a null error on success", async () => {
        const { service, messages } = await build()

        await service.markDelivery("message-1", false, "meta_token")
        await service.markDelivery("message-2", true, null)

        expect(messages.markDelivery.mock.calls).toEqual([
            ["message-1", false, "meta_token"],
            ["message-2", true, undefined],
        ])
    })
    it("checks every nonempty conversation and treats missing or agent-held turns as free", async () => {
        const { service, conversations } = await build()
        conversations.turnOf
            .mockResolvedValueOnce(refused(AgentConversationsErrorCode.NotFound))
            .mockResolvedValueOnce(ok(TURN))
            .mockResolvedValueOnce(ok({ ...TURN, id: "held-1", handledBy: "Mai" }))

        await expect(
            service.heldByPerson({ state: "escalated", conversation_id: "conv-1" }, null, "", "conv-2"),
        ).resolves.toBe(false)
        await expect(service.heldByPerson({ state: "escalated", conversation_id: null }, "", "held-1")).resolves.toBe(
            true,
        )

        expect(conversations.turnOf.mock.calls).toEqual([["conv-1"], ["conv-2"], ["held-1"]])
    })
})
