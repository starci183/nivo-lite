import { Test } from "@nestjs/testing"
import { fakeIds, mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatConversationRef } from "@modules/domain/chat-records"
import { IDS } from "@modules/platform/ids"
import { humanConversation } from "@tests/fixtures/builders/chat-features.builder"
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
    module: "chatbot",
}

const REF: ChatConversationRef = { id: "conv-1", agentId: "agent-1", leadId: null, handledBy: null, visitorName: "Lan" }

const TARGET: FlowConversationTarget = {
    workspaceId: "ws-1",
    flow: { platform: "facebook", connection_id: "connection-1", lead_id: "lead-1", name: "Lan" },
    externalId: "person-1",
    agentId: "agent-1",
}

const build = async () => {
    const bindings = mock<AgentBindingsService>()
    const agents = mock<AgentsService>()
    const conversations = mock<ChatConversationsService>()
    conversations.meet.mockResolvedValue({ conversation: REF, created: false })
    const messages = mock<ChatMessagesService>()
    messages.storeAgentLine.mockResolvedValue({ id: "message-1", body: "Hi!", sent: false })
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowConversationService,
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentsService, useValue: agents },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: IDS, useValue: ids },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFlowConversationService), bindings, agents, conversations, messages }
}

describe("LeadFlowConversationService agent", () => {
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

describe("LeadFlowConversationService ensure", () => {
    it("meets the person on the connection and ties the lead to the conversation", async () => {
        const { service, conversations } = await build()

        await expect(service.ensure(TARGET)).resolves.toBe("conv-1")

        expect(conversations.meet).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            channel: "facebook",
            customerId: "person-1",
            visitor: "Lan",
            connectionId: "connection-1",
        })
        expect(conversations.attachLead).toHaveBeenCalledWith("ws-1", "conv-1", "lead-1")
    })

    it("keeps a lead the conversation already has, and attaches none when the flow has no lead", async () => {
        const { service, conversations } = await build()
        conversations.meet.mockResolvedValueOnce({ conversation: { ...REF, leadId: "existing-lead" }, created: false })

        await expect(service.ensure(TARGET)).resolves.toBe("conv-1")
        await expect(service.ensure({ ...TARGET, flow: { ...TARGET.flow, lead_id: null } })).resolves.toBe("conv-1")

        expect(conversations.attachLead).not.toHaveBeenCalled()
    })

    it("opens nothing without a connection or a person id, and defaults an unnamed conversation to Facebook", async () => {
        const { service, conversations } = await build()

        await expect(service.ensure({ ...TARGET, flow: { ...TARGET.flow, connection_id: null } })).resolves.toBeNull()
        await expect(service.ensure({ ...TARGET, externalId: "" })).resolves.toBeNull()
        expect(conversations.meet).not.toHaveBeenCalled()
        await expect(
            service.ensure({ ...TARGET, flow: { ...TARGET.flow, platform: null, name: null, lead_id: null } }),
        ).resolves.toBe("conv-1")

        expect(conversations.meet).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            channel: "facebook",
            customerId: "person-1",
            visitor: "",
            connectionId: "connection-1",
        })
    })
})

describe("LeadFlowConversationService say", () => {
    it("stores each kind of transcript line with its delivery, and nothing for an empty one", async () => {
        const { service, messages } = await build()
        const line = { workspaceId: "ws-1", conversationId: "conv-1", delivery: null }

        await service.say({ ...line, role: "user", body: "Hello" })
        await service.say({ ...line, role: "system", body: "A person takes over" })
        await service.say({ ...line, role: "agent", body: "Hi!", delivery: { sent: false, error: "meta_token" } })
        await service.say({ ...line, role: "agent", body: "  " })

        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", null, null)
        expect(messages.storeLine).toHaveBeenCalledWith("ws-1", "conv-1", "A person takes over")
        expect(messages.storeAgentLine).toHaveBeenCalledTimes(1)
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Hi!",
            key: "00000000-0000-4000-8000-000000000001",
        })
        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "message-1", false, "meta_token")
    })

    it("stores an agent line without delivery and omits a null delivery error, while ignoring a missing conversation", async () => {
        const { service, messages } = await build()
        const line = { workspaceId: "ws-1", conversationId: "conv-1", role: "agent" as const, body: "Hi!" }

        await service.say({ ...line, conversationId: null, delivery: null })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        await service.say({ ...line, delivery: null })
        expect(messages.markDelivery).not.toHaveBeenCalled()
        await service.say({ ...line, delivery: { sent: true, error: null } })

        expect(messages.storeAgentLine).toHaveBeenCalledTimes(2)
        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "message-1", true, undefined)
        expect(messages.storeCustomer).not.toHaveBeenCalled()
        expect(messages.storeLine).not.toHaveBeenCalled()
    })
})

describe("LeadFlowConversationService stable lines", () => {
    it("stores a work item under its stable id and reports whether it already went out", async () => {
        const { service, messages } = await build()
        messages.storeAgentLine
            .mockResolvedValueOnce({ id: "message-2", body: "Hello", sent: true })
            .mockResolvedValueOnce({ id: "message-2", body: "Hello", sent: false })

        await expect(service.stableLine("ws-1", "conv-1", "Hello", "Linh", "item-1")).resolves.toEqual({
            id: "message-2",
            sent: true,
        })
        await expect(service.stableLine("ws-1", "conv-1", "Hello", "Linh", "item-1")).resolves.toEqual({
            id: "message-2",
            sent: false,
        })

        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            body: "Hello",
            key: "item-1",
            human: { name: "Linh", userId: null },
        })
    })

    it("passes delivery failures through and omits a null error on success", async () => {
        const { service, messages } = await build()

        await service.markDelivery("ws-1", "message-1", false, "meta_token")
        await service.markDelivery("ws-1", "message-2", true, null)

        expect(messages.markDelivery.mock.calls).toEqual([
            ["ws-1", "message-1", false, "meta_token"],
            ["ws-1", "message-2", true, undefined],
        ])
    })
})

const flowOf = (state: "qualifying" | "escalated", conversationId: string | null) => ({
    workspace_id: "ws-1",
    state,
    conversation_id: conversationId,
})

describe("LeadFlowConversationService held by a person", () => {
    it("tells whether a person holds an escalated flow and hands a conversation to a person", async () => {
        const { service, conversations } = await build()
        conversations.humanOf.mockResolvedValue(humanConversation({ handledBy: "Mai" }))

        await expect(service.heldByPerson(flowOf("qualifying", "conv-1"))).resolves.toBe(false)
        await expect(service.heldByPerson(flowOf("escalated", null))).resolves.toBe(true)
        await expect(service.heldByPerson(flowOf("escalated", "conv-1"))).resolves.toBe(true)
        await service.handToPerson("ws-1", "conv-1")

        expect(conversations.humanOf).toHaveBeenCalledTimes(1)
        expect(conversations.humanOf).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(conversations.setHolder).toHaveBeenCalledWith("ws-1", "conv-1", LEAD_GEN_ACTOR)
    })

    it("checks every nonempty conversation and treats missing or agent-held ones as free", async () => {
        const { service, conversations } = await build()
        conversations.humanOf
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(humanConversation())
            .mockResolvedValueOnce(humanConversation({ id: "held-1", handledBy: "Mai" }))

        await expect(service.heldByPerson(flowOf("escalated", "conv-1"), null, "", "conv-2")).resolves.toBe(false)
        await expect(service.heldByPerson(flowOf("escalated", null), "", "held-1")).resolves.toBe(true)

        expect(conversations.humanOf.mock.calls).toEqual([
            ["ws-1", "conv-1"],
            ["ws-1", "conv-2"],
            ["ws-1", "held-1"],
        ])
    })
})
