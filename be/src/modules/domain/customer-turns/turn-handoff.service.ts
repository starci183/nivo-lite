import { Injectable } from "@nestjs/common"
import { AgentConversationsService, ConversationHandoverService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { AgentHandoff, AgentHandoffRequest, JsonResult, ToolContext } from "@modules/domain/agent-tools"
import { AgentsService } from "@modules/domain/agents"
import { HANDOVER_ACTION, HANDOVER_TO_FACT } from "@modules/domain/authority-rules"
import { WorkEngineService } from "@modules/domain/decisions"
import type { DivertSource, WorkContext } from "@modules/domain/decisions"
import type { AgentProfile } from "@modules/domain/agents"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HubNotesService } from "./hub-notes.service"
import { TurnSourcesService } from "./turn-sources.service"

const LOCALE = "vi"
/** Who the engine names as the actor of a hand-over a person must approve. */
const ENGINE_ACTOR = "OpenClaw"

@Injectable()
/**
 * `conversation.handOff`: the agent hands its own customer conversation to another agent of the workspace when the business knowledge
 * says so (for example Sales to Customer care once a booking is confirmed). The move and its ownership record commit together; a
 * conversation a person holds, an unknown agent or the agent itself stays where it is, and an owner's test chat is never moved (a typed
 * `simulation` answer), so a test leaves no ownership record. Both agents' home rooms get the hand-off note, which lists the knowledge
 * the turn read as its sources. The graph of the agent judges the move first: it can hold it for a person, stop it, or lead elsewhere.
 */
export class TurnHandoffService implements AgentHandoff {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: AgentConversationsService,
        private readonly handover: ConversationHandoverService,
        private readonly agents: AgentsService,
        private readonly notes: HubNotesService,
        private readonly sources: TurnSourcesService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Hands the job's conversation to the named agent; the answer says where it went or why it stayed. */
    async handOff(ctx: ToolContext, request: AgentHandoffRequest): Promise<JsonResult> {
        const turn = await this.conversations.turnOf(ctx.conversationId)
        if (turn.kind === "refused" || turn.value.workspaceId !== ctx.workspaceId) return { status: "not_found" }
        const conversation = turn.value
        if (conversation.handledBy !== null) return { status: "held_by_person" }
        if (await this.conversations.isTestChat(conversation.id)) return { status: "simulation" }
        const target = await this.agents.profileByReference(ctx.workspaceId, request.to)
        if (target === null) return { status: "no_such_agent" }
        if (target.id === conversation.agent.id) return { status: "already_there" }
        const held = await this.heldByGraph(ctx, conversation, request, target)
        if (held !== null) return held
        const moved = await this.handover.handOver({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            fromAgentId: conversation.agent.id,
            toAgentId: target.id,
            reason: request.note,
        })
        if (!moved) return { status: "not_moved" }
        await this.postNote(conversation, target, request.note, ctx.jobId)
        return { status: "handed_off", to: target.name }
    }

    /** What the graph says about this move, as the answer to the agent; null when it may go ahead. */
    private async heldByGraph(
        ctx: ToolContext,
        conversation: TurnConversation,
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
            money: null,
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
        conversation: TurnConversation,
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
