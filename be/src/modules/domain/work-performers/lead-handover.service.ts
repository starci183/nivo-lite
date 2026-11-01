import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentConversationsService, ConversationHandoverService } from "@modules/domain/agent-conversations"
import type { WorkContext } from "@modules/domain/decisions"
import { PerformerKitService } from "./performer-kit.service"

/** The module whose agent takes over a conversation once its customer is captured. */
const SALES_MODULE = "sales"

@Injectable()
/**
 * Hands the conversation a lead was captured in to the Sales agent bound to the same connection, so the next message of the customer
 * is answered by Sales under the name the customer already knows. Nothing moves when no Sales agent may act on that connection (the
 * lead is captured and the Chatbot keeps answering), when the chat is an owner's test, or when a person holds the conversation.
 */
export class LeadHandoverService {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly handover: ConversationHandoverService,
        private readonly bindings: AgentBindingsService,
        private readonly kit: PerformerKitService,
    ) {}

    /** Moves the conversation to the bound Sales agent; true when it moved. */
    async toSales(ctx: WorkContext, conversationId: string, customerName: string): Promise<boolean> {
        const turn = await this.conversations.turnOf(conversationId)
        if (turn.kind === "refused" || turn.value.workspaceId !== ctx.workspaceId) return false
        const conversation = turn.value
        if (conversation.handledBy !== null) return false
        if (await this.conversations.isTestChat(conversation.id)) return false
        const reachable = await this.bindings.handoversOf(conversation.connectionId, conversation.agent)
        const sales = reachable.find((agent) => agent.module === SALES_MODULE)
        if (sales === undefined) return false
        return this.handover.handOver({
            workspaceId: ctx.workspaceId,
            conversationId: conversation.id,
            fromAgentId: conversation.agent.id,
            toAgentId: sales.id,
            reason: this.kit.text(ctx, "handoffOwnership", { name: customerName }),
        })
    }
}
