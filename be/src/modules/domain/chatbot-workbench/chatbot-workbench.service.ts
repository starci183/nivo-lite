import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { ModulesService } from "@modules/domain/modules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentConversationsError, AgentConversationsErrorCode } from "@modules/domain/agent-conversations"
import type { ChatbotGaps, ChatbotOverview, ChatbotOverviewRequest, ChatbotThread } from "./chatbot-workbench.contracts"
import { buildChatbotOverview, emptyChatbotOverview } from "./overview.mapper"
import { buildChatbotThread } from "./thread.mapper"
import { waitingConversationId } from "./conversation.policy"
import type {
    AgentIdRow,
    ConversationRow,
    ChatbotInstallationRow,
    LeadBriefRow,
    LeadRow,
    LensRow,
    MessageBriefRow,
    MessageRow,
    ChatbotStaffRow,
    WaitingRow,
} from "./persistence/chatbot-workbench.rows"
import {
    FIND_CHATBOT_CONVERSATION,
    FIND_CHATBOT_LEAD,
    FIND_CHATBOT_STAFF,
    LIST_CHATBOT_AGENTS,
    LIST_CHATBOT_CONVERSATIONS,
    LIST_CHATBOT_INSTALLATIONS,
    LIST_CHATBOT_LEAD_BRIEFS,
    LIST_CHATBOT_LENSES,
    LIST_CHATBOT_MESSAGE_BRIEFS,
    LIST_CHATBOT_MESSAGES,
    LIST_CHATBOT_WAITING,
} from "./persistence/chatbot-workbench.sql"

const DAY_MS = 86_400_000

@Injectable()
/** Authorized reads of the customer inbox, open threads and gaps in the workspace brain. */
export class ChatbotWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly knowledgeGaps: KnowledgeGapsService,
        private readonly modules: ModulesService,
    ) {}

    /** The selected installation's customer conversations with activity and capture figures. */
    async overview(userId: string, request: ChatbotOverviewRequest): Promise<ChatbotOverview> {
        await this.members.require(userId, request.workspaceId)
        const now = this.clock.now().getTime()
        const agents = await this.agentIds(request)
        if (agents.length === 0) return emptyChatbotOverview(request.workspaceId, now)
        const conversations = await this.entityManager.query<Array<ConversationRow>>(LIST_CHATBOT_CONVERSATIONS, [
            request.workspaceId,
            agents,
        ])
        if (conversations.length === 0) return emptyChatbotOverview(request.workspaceId, now)
        const ids = conversations.map((row) => row.id)
        const leadIds = conversations.flatMap((row) => (row.lead_id === null ? [] : [row.lead_id]))
        const [messages, waiting, leads] = await Promise.all([
            this.entityManager.query<Array<MessageBriefRow>>(LIST_CHATBOT_MESSAGE_BRIEFS, [
                request.workspaceId,
                ids,
                new Date(now - 30 * DAY_MS),
            ]),
            this.entityManager.query<Array<WaitingRow>>(LIST_CHATBOT_WAITING, [request.workspaceId]),
            this.entityManager.query<Array<LeadBriefRow>>(LIST_CHATBOT_LEAD_BRIEFS, [request.workspaceId, leadIds]),
        ])
        return buildChatbotOverview({ workspaceId: request.workspaceId, now, conversations, messages, waiting, leads })
    }

    /** A customer conversation of the caller's workspace with its lead and assigned escalation. */
    async thread(userId: string, workspaceId: string, conversationId: string): Promise<ChatbotThread> {
        await this.members.require(userId, workspaceId)
        const [conversation] = await this.entityManager.query<Array<ConversationRow>>(FIND_CHATBOT_CONVERSATION, [
            workspaceId,
            conversationId,
        ])
        if (conversation === undefined)
            throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotFound })
        const [messages, waiting, leads] = await Promise.all([
            this.entityManager.query<Array<MessageRow>>(LIST_CHATBOT_MESSAGES, [workspaceId, conversationId]),
            this.entityManager.query<Array<WaitingRow>>(LIST_CHATBOT_WAITING, [workspaceId]),
            this.entityManager.query<Array<LeadRow>>(FIND_CHATBOT_LEAD, [workspaceId, conversation.lead_id]),
        ])
        const item = waiting.find((row) => waitingConversationId(row) === conversationId)
        const [staff] =
            item?.assigned_staff_id === undefined || item.assigned_staff_id === null
                ? []
                : await this.entityManager.query<Array<ChatbotStaffRow>>(FIND_CHATBOT_STAFF, [
                      workspaceId,
                      item.assigned_staff_id,
                  ])
        return buildChatbotThread({
            conversation,
            messages,
            waiting,
            lead: leads[0] ?? null,
            staffName: staff?.name ?? null,
        })
    }

    /** The open customer questions and active catalog agents an owner or manager may answer for. */
    async gaps(userId: string, workspaceId: string): Promise<ChatbotGaps> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        const [gaps, agents, catalog] = await Promise.all([
            this.knowledgeGaps.list(workspaceId, ["open"], 50),
            this.entityManager.query<Array<LensRow>>(LIST_CHATBOT_LENSES, [workspaceId]),
            this.modules.catalog(),
        ])
        const definitions = new Map(catalog.modules.map((module) => [module.key, module]))
        const unique = agents.filter(
            (agent, index, all) =>
                definitions.has(agent.module) && all.findIndex((other) => other.module === agent.module) === index,
        )
        return {
            gaps,
            lenses: unique.map((agent) => ({
                module: agent.module,
                name: agent.name,
                audience: definitions.get(agent.module)?.audience ?? "internal",
            })),
        }
    }

    /** Multiple installations each use their own agent; a single installation also includes legacy Chatbot agents. */
    private async agentIds(request: ChatbotOverviewRequest): Promise<Array<string>> {
        if (request.installationId !== null && request.installationId !== undefined) {
            const installations = await this.entityManager.query<Array<ChatbotInstallationRow>>(
                LIST_CHATBOT_INSTALLATIONS,
                [request.workspaceId],
            )
            const own = installations.find((row) => row.id === request.installationId)
            if (own === undefined) return []
            if (installations.length > 1) return own.agent_id === null ? [] : [own.agent_id]
        }
        const agents = await this.entityManager.query<Array<AgentIdRow>>(LIST_CHATBOT_AGENTS, [request.workspaceId])
        return agents.map((agent) => agent.id)
    }
}
