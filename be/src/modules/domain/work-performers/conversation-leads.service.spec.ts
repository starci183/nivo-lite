import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { ToolContext } from "@modules/domain/agent-tools"
import { ConversationLeadsService } from "./conversation-leads.service"

const ctx: ToolContext = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

const agent = {
    id: "agent-1",
    name: "Mai",
    handle: "mai",
    role: "sales",
    module: "sales",
    instructions: "Be brief",
    knowledge: "",
    approvalRule: "",
    greeting: "Hello",
}

const turnOf = (leadId: string | null): TurnConversation => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "website",
    externalId: null,
    connectionId: null,
    leadId,
    handledBy: null,
    visitorName: "Lan",
    installationId: null,
    agent,
})

describe("ConversationLeadsService", () => {
    const build = async () => {
        const conversations = mock<AgentConversationsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [ConversationLeadsService, { provide: AgentConversationsService, useValue: conversations }],
        }).compile()
        return { leads: moduleRef.get(ConversationLeadsService), conversations }
    }

    it("answers the lead of the conversation", async () => {
        const { leads, conversations } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: turnOf("lead-1") })

        await expect(leads.leadIdOf(ctx)).resolves.toBe("lead-1")

        expect(conversations.turnOf).toHaveBeenCalledWith("conv-1")
    })

    it("answers null when the customer is not a lead yet", async () => {
        const { leads, conversations } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: turnOf(null) })

        await expect(leads.leadIdOf(ctx)).resolves.toBeNull()
    })

    it("answers null when the conversation cannot be read", async () => {
        const { leads, conversations } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "refused", code: AgentConversationsErrorCode.NotFound })

        await expect(leads.leadIdOf(ctx)).resolves.toBeNull()
    })
})
