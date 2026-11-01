import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentsService } from "@modules/domain/agents"
import { AgentConversationsService, ConversationHandoverService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { WorkContext } from "@modules/domain/decisions"
import { PerformerKitService } from "./performer-kit.service"

/** The module whose agent takes over a conversation once its customer is captured. */
const SALES_MODULE = "sales"
/** The chat on the business's own site, which no connection carries. */
const WEBSITE_CHANNEL = "website"

@Injectable()
/**
 * Hands the conversation a lead was captured in to the Sales agent bound to the same connection, so the next message of the customer
 * is answered by Sales under the name the customer already knows. The website chat has no connection to bind, so it reaches the
 * workspace's active Sales agent. Nothing moves when no Sales agent may act on that connection (the lead is captured and the Chatbot
 * keeps answering), when the chat is an owner's test, or when a person holds the conversation.
 */
export class LeadHandoverService {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly handover: ConversationHandoverService,
        private readonly bindings: AgentBindingsService,
        private readonly agents: AgentsService,
        private readonly kit: PerformerKitService,
    ) {}

    /** Moves the conversation to the bound Sales agent; true when it moved. */
    async toSales(ctx: WorkContext, conversationId: string, customerName: string): Promise<boolean> {
        const turn = await this.conversations.turnOf(conversationId)
        if (turn.kind === "refused" || turn.value.workspaceId !== ctx.workspaceId) return false
        const conversation = turn.value
        if (conversation.handledBy !== null) return false
        if (await this.conversations.isTestChat(conversation.id)) return false
        const salesId = await this.salesOf(ctx, conversation)
        if (salesId === null) return false
        return this.handover.handOver({
            workspaceId: ctx.workspaceId,
            conversationId: conversation.id,
            fromAgentId: conversation.agent.id,
            toAgentId: salesId,
            reason: this.kit.text(ctx, "handoffOwnership", { name: customerName }),
        })
    }

    /** The Sales agent this conversation can reach: the active one for the website chat, else the one bound to its connection. */
    private async salesOf(ctx: WorkContext, conversation: TurnConversation): Promise<string | null> {
        if (conversation.connectionId === null && conversation.channel === WEBSITE_CHANNEL) {
            const sales = await this.agents.agentOfDepartment(ctx.workspaceId, SALES_MODULE, null)
            return sales?.id ?? null
        }
        const reachable = await this.bindings.handoversOf(conversation.connectionId, conversation.agent)
        return reachable.find((agent) => agent.module === SALES_MODULE)?.id ?? null
    }
}
