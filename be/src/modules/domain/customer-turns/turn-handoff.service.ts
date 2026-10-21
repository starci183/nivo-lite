import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { AgentHandoff, AgentHandoffRequest, JsonResult, ToolContext } from "@modules/domain/agent-tools"
import { AgentsService, InjectInstallations } from "@modules/domain/agents"
import type { AgentProfile, InstallationDirectory } from "@modules/domain/agents"
import { ConversationOwnershipEventsService } from "@modules/domain/conversation-ownership-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HubNotesService } from "./hub-notes.service"
import { TurnSourcesService } from "./turn-sources.service"

const LOCALE = "vi"
/** An agent id: anything else the agent names is a department (module key). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

@Injectable()
/**
 * `conversation.handOff`: the agent hands its own customer conversation to another agent of the workspace when the business knowledge
 * says so (for example Sales to Customer care once a booking is confirmed). The move and its ownership record commit together; a
 * conversation a person holds, an unknown agent or the agent itself stays where it is, and an owner's test chat is never moved (a typed
 * `simulation` answer), so a test leaves no ownership record. Both agents' home rooms get the hand-off note, which lists the knowledge
 * the turn read as its sources.
 */
export class TurnHandoffService implements AgentHandoff {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        private readonly conversations: AgentConversationsService,
        private readonly agents: AgentsService,
        private readonly ownership: ConversationOwnershipEventsService,
        private readonly notes: HubNotesService,
        private readonly sources: TurnSourcesService,
    ) {}

    /** Hands the job's conversation to the named agent; the answer says where it went or why it stayed. */
    async handOff(ctx: ToolContext, request: AgentHandoffRequest): Promise<JsonResult> {
        const turn = await this.conversations.turnOf(ctx.conversationId)
        if (turn.kind === "refused" || turn.value.workspaceId !== ctx.workspaceId) return { status: "not_found" }
        const conversation = turn.value
        if (conversation.handledBy !== null) return { status: "held_by_person" }
        if (await this.conversations.isTestChat(conversation.id)) return { status: "simulation" }
        const target = await this.targetOf(ctx.workspaceId, request.to)
        if (target === null) return { status: "no_such_agent" }
        if (target.id === conversation.agent.id) return { status: "already_there" }
        const moved = await this.move(conversation, target, request.note)
        if (!moved) return { status: "not_moved" }
        await this.postNote(conversation, target, request.note, ctx.jobId)
        return { status: "handed_off", to: target.name }
    }

    private targetOf(workspaceId: string, to: string): Promise<AgentProfile | null> {
        return UUID.test(to) ? this.agents.profileOf(workspaceId, to) : this.agents.profileOfDepartment(workspaceId, to)
    }

    /** Moves the conversation and records why, in one transaction; false when the move did not apply. */
    private async move(conversation: TurnConversation, target: AgentProfile, note: string): Promise<boolean> {
        const installation = await this.installations.ofAgent(conversation.workspaceId, target.id)
        return this.entityManager.transaction(async (manager) => {
            const handed = await this.conversations.handToAgent({
                manager,
                workspaceId: conversation.workspaceId,
                conversationId: conversation.id,
                agentId: target.id,
                installationId: installation?.id ?? null,
            })
            if (handed) {
                await this.ownership.record({
                    manager,
                    workspaceId: conversation.workspaceId,
                    conversationId: conversation.id,
                    fromAgentId: conversation.agent.id,
                    toAgentId: target.id,
                    reason: note,
                })
            }
            return handed
        })
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
