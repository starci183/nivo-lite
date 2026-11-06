import { Injectable } from "@nestjs/common"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
import type { AgentHandoff, AgentHandoffRequest, JsonResult, ToolContext } from "@modules/domain/agent-tools"
import { AgentsService } from "@modules/domain/agents"
import { HANDOVER_ACTION, HANDOVER_TO_FACT } from "@modules/domain/authority-rules"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import type { AgentProfile } from "@modules/domain/agents"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HubNotesService } from "./hub-notes.service"
import { TurnSourcesService } from "./turn-sources.service"

type DivertSource = Parameters<WorkEngineService["runDiverted"]>[2]

const LOCALE = "vi"
/** Who the engine names as the actor of a hand-over a person must approve. */
const ENGINE_ACTOR = "OpenClaw"

@Injectable()
/**
 * `conversation.handOff`: the agent hands its own customer conversation to another agent of the workspace when the business knowledge
 * says so (for example Sales to Customer care once a booking is confirmed). The conversation follows the other agent through the
 * conversation records; a conversation a person holds, an unknown agent, the agent itself or a conversation with no channel address stays
 * where it is. Both agents' home rooms get the hand-off note, which lists the knowledge the turn read as its sources. The graph of the agent judges the move first: it can hold it for a person, stop it, or lead elsewhere.
 */
export class TurnHandoffService implements AgentHandoff {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: ChatConversationsService,
        private readonly agents: AgentsService,
        private readonly notes: HubNotesService,
        private readonly sources: TurnSourcesService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Hands the job's conversation to the named agent; the answer says where it went or why it stayed. */
    async handOff(ctx: ToolContext, request: AgentHandoffRequest): Promise<JsonResult> {
        const turn = await this.conversations.turnOf(ctx.workspaceId, ctx.conversationId)
        if (turn.kind === "refused") return { status: "not_found" }
        const conversation = turn.value
        if (conversation.handledBy !== null) return { status: "held_by_person" }
        const target = await this.agents.profileByReference(ctx.workspaceId, request.to)
        if (target === null) return { status: "no_such_agent" }
        if (target.id === conversation.agent.id) return { status: "already_there" }
        const held = await this.heldByGraph(ctx, conversation, request, target)
        if (held !== null) return held
        if (!(await this.move(conversation, target))) return { status: "not_moved" }
        await this.postNote(conversation, target, request.note, ctx.jobId)
        return { status: "handed_off", to: target.name }
    }

    /** Makes the conversation follow the target agent; false when it has no channel address to meet the customer by or does not stay the same conversation. */
    private async move(conversation: ChatTurnConversation, target: AgentProfile): Promise<boolean> {
        const { externalId, connectionId } = conversation
        if (externalId === null || connectionId === null) return false
        const met = await this.conversations.meet({
            workspaceId: conversation.workspaceId,
            agentId: target.id,
            channel: conversation.channel,
            customerId: externalId,
            visitor: conversation.visitorName ?? "",
            connectionId,
        })
        return met.conversation.id === conversation.id && met.conversation.agentId === target.id
    }

    /** What the graph says about this move, as the answer to the agent; null when it may go ahead. */
    private async heldByGraph(
        ctx: ToolContext,
        conversation: ChatTurnConversation,
        request: AgentHandoffRequest,
        target: AgentProfile,
    ): Promise<JsonResult | null> {
        const graph = await this.engine.checkGraph({
            workspaceId: conversation.workspaceId,
            installationId: conversation.installationId,
            action: HANDOVER_ACTION,
            road: "handover",
            key: `${ctx.jobId}:${conversation.id}:${target.id}`,
            subjectType: "conversation",
            subjectId: conversation.id,
            leadId: conversation.leadId,
            text: null,
            evidence: null,
            attributes: { [HANDOVER_TO_FACT]: target.module },
            turnId: null,
            wakeId: null,
            askOpensWork: true,
        })
        if (graph.outcome === "run") return null
        if (graph.outcome === "stop") return { status: "stopped_by_graph" }
        const work: WorkContext = { workspaceId: conversation.workspaceId, actor: ENGINE_ACTOR, locale: LOCALE }
        const source: DivertSource = {
            key: `${ctx.jobId}:${conversation.id}`,
            subjectType: "conversation",
            subjectId: conversation.id,
            leadId: conversation.leadId,
            installationId: conversation.installationId,
            origin: null,
            proposal: {
                summary: this.catalog.get("gatewayTurns.handOverSummary", { to: target.name }, LOCALE),
                fields: { to: target.id, note: request.note },
            },
        }
        const divert = graph.divert ?? { action: HANDOVER_ACTION, handoverTo: target.id, asks: true }
        const item = await this.engine.runDiverted(work, divert, source)
        return { status: graph.outcome === "ask" ? "approval_requested" : "diverted_by_graph", work_item_id: item.id }
    }

    /** The hand-off note, once in the home room of each of the two agents. */
    private async postNote(
        conversation: ChatTurnConversation,
        target: AgentProfile,
        note: string,
        jobId: string,
    ): Promise<void> {
        const title = this.catalog.get(
            "gatewayTurns.cardHandoff",
            { name: conversation.visitorName ?? "", from: conversation.agent.name, to: target.name, why: note },
            LOCALE,
        )
        const refs = { leadId: conversation.leadId, workItemId: null }
        await Promise.all(
            [conversation.agent.id, target.id].map((agentId) =>
                this.notes.post(
                    {
                        workspaceId: conversation.workspaceId,
                        room: "",
                        type: "handoff_note",
                        title,
                        fields: [],
                        authorName: target.name,
                        sources: this.sources.of(jobId),
                    },
                    agentId,
                    refs,
                ),
            ),
        )
    }
}
