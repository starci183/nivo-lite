import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import type { BoundAgent } from "@modules/domain/agent-connections"
import {
    AgentConversationsErrorCode,
    AgentConversationsService,
    ConversationHandoverService,
} from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { WorkContext } from "@modules/domain/decisions"
import { LeadHandoverService } from "./lead-handover.service"
import { PerformerKitService } from "./performer-kit.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const CONVERSATION: TurnConversation = {
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "zalo",
    externalId: "z1",
    connectionId: "conn-1",
    leadId: "lead-1",
    handledBy: null,
    visitorName: "Lan",
    installationId: "inst-chat",
    agent: {
        id: "chat-agent",
        name: "Chatbot",
        handle: "chatbot",
        role: "Customer chat",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
    speaksAs: null,
}

const bound = (module: string, id: string): BoundAgent => ({
    id,
    module,
    name: module,
    access: "auto",
    purpose: "inbound_chat",
})

const build = async (
    reachable: ReadonlyArray<BoundAgent> = [bound("sales", "sales-agent")],
    conversation: TurnConversation = CONVERSATION,
    activeSales: { readonly id: string } | null = { id: "site-sales" },
) => {
    const agents = mock<AgentsService>({ agentOfDepartment: jest.fn().mockResolvedValue(activeSales) })
    const conversations = mock<AgentConversationsService>({
        turnOf: jest.fn().mockResolvedValue({ kind: "ok", value: conversation }),
        isTestChat: jest.fn().mockResolvedValue(false),
    })
    const handover = mock<ConversationHandoverService>({ handOver: jest.fn().mockResolvedValue(true) })
    const bindings = mock<AgentBindingsService>({ handoversOf: jest.fn().mockResolvedValue(reachable) })
    const kit = mock<PerformerKitService>({
        text: jest.fn((_ctx: WorkContext, key: string, params?: Readonly<Record<string, string | number>>) =>
            [key, ...Object.values(params ?? {})].join("|"),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadHandoverService,
            { provide: AgentConversationsService, useValue: conversations },
            { provide: ConversationHandoverService, useValue: handover },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentsService, useValue: agents },
            { provide: PerformerKitService, useValue: kit },
        ],
    }).compile()
    return { service: moduleRef.get(LeadHandoverService), conversations, handover, bindings }
}

describe("LeadHandoverService toSales", () => {
    it("moves the conversation to the Sales agent bound to its connection and says why in the customer's name", async () => {
        const { service, handover, bindings } = await build()

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(true)

        expect(bindings.handoversOf).toHaveBeenCalledWith("conn-1", CONVERSATION.agent)
        expect(handover.handOver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            fromAgentId: "chat-agent",
            toAgentId: "sales-agent",
            reason: "handoffOwnership|Lan",
        })
    })

    it("picks Sales among the agents it can hand over to", async () => {
        const { service, handover } = await build([bound("booking", "booking-agent"), bound("sales", "sales-agent")])

        await service.toSales(ctx, "conv-1", "Lan")

        expect(handover.handOver).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: "sales-agent" }))
    })

    it("keeps the Chatbot answering when no Sales agent may act on the connection", async () => {
        const { service, handover } = await build([bound("booking", "booking-agent")])

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("keeps the Chatbot answering when the agent holds only read access, which the binding read leaves out", async () => {
        const { service, handover } = await build([])

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("leaves an owner's test chat where it is", async () => {
        const { service, conversations, handover, bindings } = await build()
        conversations.isTestChat.mockResolvedValueOnce(true)

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)
        expect(bindings.handoversOf).not.toHaveBeenCalled()
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("leaves a conversation a person holds, a missing one and one of another workspace", async () => {
        const { service, conversations, handover } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, handledBy: "Mai" } })
        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: AgentConversationsErrorCode.NotFound })
        await expect(service.toSales(ctx, "conv-9", "Lan")).resolves.toBe(false)
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, workspaceId: "other" } })
        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("reports a move the store did not apply", async () => {
        const { service, handover } = await build()
        handover.handOver.mockResolvedValueOnce(false)

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)
    })
})

describe("LeadHandoverService website chat", () => {
    it("hands a website chat, which no connection carries, to the active Sales agent", async () => {
        const website = { ...CONVERSATION, channel: "website", connectionId: null }
        const { service, handover } = await build([], website)

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(true)

        expect(handover.handOver).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: "site-sales" }))
    })

    it("keeps the Chatbot answering on a website chat when the workspace has no active Sales agent", async () => {
        const website = { ...CONVERSATION, channel: "website", connectionId: null }
        const { service, handover } = await build([], website, null)

        await expect(service.toSales(ctx, "conv-1", "Lan")).resolves.toBe(false)

        expect(handover.handOver).not.toHaveBeenCalled()
    })
})
