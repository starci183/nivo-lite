import { Injectable } from "@nestjs/common"
import { AgentConversationsService, ConversationHandoverService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { textOf } from "./performer.policy"

@Injectable()
/**
 * `hand_over_conversation`: a hand-over the graph held for a person, or one a branch named in place of what the agent proposed. It moves
 * the conversation through the one door hand-overs use, so a conversation a person holds stays where it is. Nothing is claimed if it did
 * not move.
 */
export class HandOverConversationPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly agents: AgentsService,
        private readonly conversations: AgentConversationsService,
        private readonly handover: ConversationHandoverService,
    ) {}

    /** The proposal is preset by the road that held it. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Moves the conversation to the agent the proposal names. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const { fields } = proposal
        const turn = await this.conversations.turnOf(textOf(fields.conversation_id))
        const target = await this.agents.profileByReference(ctx.workspaceId, textOf(fields.to))
        if (turn.kind === "refused" || target === null || turn.value.workspaceId !== ctx.workspaceId)
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        const moved = await this.handover.handOver({
            workspaceId: ctx.workspaceId,
            conversationId: turn.value.id,
            fromAgentId: turn.value.agent.id,
            toAgentId: target.id,
            reason: textOf(fields.note),
        })
        if (!moved)
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        return {
            summary: this.kit.text(ctx, "handedOver", { name: target.name }),
            evidence: "captured",
            lead_id: item.lead_id,
        }
    }
}
