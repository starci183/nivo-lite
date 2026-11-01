import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { LeadAutomationReadService, LeadReadService } from "@modules/domain/leads"
import { InstallationOperationsService } from "@modules/domain/module-installations"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { ModulesService } from "@modules/domain/modules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import {
    AgentConversationsError,
    AgentConversationsErrorCode,
    AgentConversationsReadService,
} from "@modules/domain/agent-conversations"
import { AgentMessagesReadService } from "@modules/domain/agent-messages"
import type { ChatbotGaps, ChatbotOverview, ChatbotOverviewRequest, ChatbotThread } from "./chatbot-workbench.contracts"
import { buildChatbotOverview, emptyChatbotOverview } from "./overview.mapper"
import { buildChatbotThread } from "./thread.mapper"
import { waitingConversationId } from "./conversation.policy"
import type { WaitingRow } from "./persistence/chatbot-workbench.rows"

const DAY_MS = 86_400_000

@Injectable()
/** Authorized reads of the customer inbox, open threads and gaps in the workspace brain. */
export class ChatbotWorkbenchService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly knowledgeGaps: KnowledgeGapsService,
        private readonly modules: ModulesService,
        private readonly staff: StaffDirectoryService,
        private readonly work: WorkItemsActivityService,
        private readonly installs: InstallationOperationsService,
        private readonly leads: LeadReadService,
        private readonly leadFacts: LeadAutomationReadService,
        private readonly agentDirectory: AgentDirectoryService,
        private readonly conversationReads: AgentConversationsReadService,
        private readonly messageReads: AgentMessagesReadService,
    ) {}

    /** The selected installation's customer conversations with activity and capture figures. */
    async overview(userId: string, request: ChatbotOverviewRequest): Promise<ChatbotOverview> {
        await this.members.require(userId, request.workspaceId)
        const now = this.clock.now().getTime()
        const agents = await this.agentIds(request)
        if (agents.length === 0) return emptyChatbotOverview(request.workspaceId, now)
        const conversations = await this.conversationReads.customerOfAgents(request.workspaceId, agents, 200)
        if (conversations.length === 0) return emptyChatbotOverview(request.workspaceId, now)
        const ids = conversations.map((row) => row.id)
        const leadIds = conversations.flatMap((row) => (row.lead_id === null ? [] : [row.lead_id]))
        const [messages, waiting, leads, agentNames] = await Promise.all([
            this.messageReads.briefsIn(request.workspaceId, ids, new Date(now - 30 * DAY_MS), 6000),
            this.waiting(request.workspaceId),
            this.leads.listByIds(request.workspaceId, leadIds),
            this.agentNamesOf(
                request.workspaceId,
                conversations.map((row) => row.agent_id),
            ),
        ])
        const staffNames = await this.staffNamesOf(request.workspaceId, waiting)
        return buildChatbotOverview({
            workspaceId: request.workspaceId,
            now,
            conversations,
            messages,
            waiting,
            leads,
            agentIds: agents,
            agentNames,
            staffNames,
        })
    }

    /** A customer conversation of the caller's workspace with its lead and assigned escalation. */
    async thread(userId: string, workspaceId: string, conversationId: string): Promise<ChatbotThread> {
        await this.members.require(userId, workspaceId)
        const conversation = await this.conversationReads.customerById(workspaceId, conversationId)
        if (conversation === null) throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotFound })
        const [messages, waiting, lead] = await Promise.all([
            this.messageReads.threadOf(workspaceId, conversationId, 500),
            this.waiting(workspaceId),
            conversation.lead_id === null ? undefined : this.leadFacts.lead(workspaceId, conversation.lead_id),
        ])
        const item = waiting.find((row) => waitingConversationId(row) === conversationId)
        const staffNames = await this.staffNamesOf(workspaceId, item === undefined ? [] : [item])
        const agentNames = await this.agentNamesOf(workspaceId, [conversation.agent_id])
        const staffId = item?.assigned_staff_id ?? null
        return buildChatbotThread({
            conversation,
            messages,
            waiting,
            lead: lead ?? null,
            staffName: staffId === null ? null : (staffNames.get(staffId) ?? null),
            agentNames,
        })
    }

    /** The open customer questions and active catalog agents an owner or manager may answer for. */
    async gaps(userId: string, workspaceId: string): Promise<ChatbotGaps> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        const [gaps, agents, catalog] = await Promise.all([
            this.knowledgeGaps.list(workspaceId, ["open"], 50),
            this.agentDirectory.activeLensesOf(workspaceId, 100),
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
            const installations = await this.installs.agentLinksOf(request.workspaceId, "chatbot", 100)
            const own = installations.find((row) => row.id === request.installationId)
            if (own === undefined) return []
            if (installations.length > 1) return own.agentId === null ? [] : [own.agentId]
        }
        return this.agentDirectory.idsOfModule(request.workspaceId, "chatbot", 100)
    }

    /** The display names of the agents, by agent id. */
    private async agentNamesOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<Map<string, string>> {
        const cards = await this.agentDirectory.cardsOf(workspaceId, [...new Set(agentIds)])
        return new Map(cards.map((card) => [card.id, card.name]))
    }

    /** The display names of the staff the waiting replies are assigned to, by staff id. */
    private async staffNamesOf(workspaceId: string, waiting: ReadonlyArray<WaitingRow>): Promise<Map<string, string>> {
        const ids = waiting.flatMap((row) => (row.assigned_staff_id === null ? [] : [row.assigned_staff_id]))
        if (ids.length === 0) return new Map()
        const staff = await this.staff.namesOf(workspaceId, [...new Set(ids)])
        return new Map(staff.map((member) => [member.id, member.name]))
    }

    /** The customer-reply work items waiting for a decision, oldest first. */
    private waiting(workspaceId: string): Promise<Array<WaitingRow>> {
        return this.work.waitingReplies(workspaceId, 200)
    }
}
