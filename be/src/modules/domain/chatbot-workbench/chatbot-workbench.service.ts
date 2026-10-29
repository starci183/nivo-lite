import { Injectable } from "@nestjs/common"
import type { EntityManager, EntityTarget, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { AgentEntity } from "@modules/domain/agents"
import { LeadEntity } from "@modules/domain/leads"
import { ModuleInstallationEntity } from "@modules/domain/module-installations"
import { StaffEntity } from "@modules/domain/staff"
import { WorkItemEntity } from "@modules/domain/work-items"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { ModulesService } from "@modules/domain/modules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    AgentConversationEntity,
    AgentConversationsError,
    AgentConversationsErrorCode,
} from "@modules/domain/agent-conversations"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
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

const CONVERSATION_COLUMNS = [
    "id",
    "channel",
    "visitor_name",
    "lead_id",
    "handled_by",
    "handled_at",
    "external_id",
    "created_at",
] as const

/** A read of the named columns of one table, each answered under its own column name. */
const readFrom = (
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    alias: string,
    columns: ReadonlyArray<string>,
): SelectQueryBuilder<ObjectLiteral> => {
    const [first = "id", ...rest] = columns
    return rest.reduce(
        (query, column) => query.addSelect(`${alias}.${column}`, column),
        manager.createQueryBuilder(entity, alias).select(`${alias}.${first}`, first),
    )
}

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
        const conversations = await readFrom(this.entityManager, AgentConversationEntity, "c", CONVERSATION_COLUMNS)
            .where("c.workspace_id = :workspaceId AND c.kind = 'customer'", { workspaceId: request.workspaceId })
            .andWhere("c.agent_id IN (:...agents)", { agents })
            .orderBy("c.created_at", "DESC")
            .limit(200)
            .getRawMany<ConversationRow>()
        if (conversations.length === 0) return emptyChatbotOverview(request.workspaceId, now)
        const ids = conversations.map((row) => row.id)
        const leadIds = conversations.flatMap((row) => (row.lead_id === null ? [] : [row.lead_id]))
        const [messages, waiting, leads] = await Promise.all([
            readFrom(this.entityManager, AgentMessageEntity, "m", [
                "id",
                "conversation_id",
                "role",
                "body",
                "created_at",
            ])
                .where("m.workspace_id = :workspaceId AND m.conversation_id IN (:...ids)", {
                    workspaceId: request.workspaceId,
                    ids,
                })
                .andWhere("m.created_at >= :since::timestamptz", { since: new Date(now - 30 * DAY_MS) })
                .orderBy("m.created_at")
                .addOrderBy("m.id")
                .limit(6000)
                .getRawMany<MessageBriefRow>(),
            this.waiting(request.workspaceId),
            leadIds.length === 0
                ? Promise.resolve<Array<LeadBriefRow>>([])
                : readFrom(this.entityManager, LeadEntity, "l", ["id", "contact_name", "created_at"])
                      .where("l.workspace_id = :workspaceId AND l.id IN (:...leadIds)", {
                          workspaceId: request.workspaceId,
                          leadIds,
                      })
                      .limit(200)
                      .getRawMany<LeadBriefRow>(),
        ])
        return buildChatbotOverview({ workspaceId: request.workspaceId, now, conversations, messages, waiting, leads })
    }

    /** A customer conversation of the caller's workspace with its lead and assigned escalation. */
    async thread(userId: string, workspaceId: string, conversationId: string): Promise<ChatbotThread> {
        await this.members.require(userId, workspaceId)
        const [conversation] = await readFrom(this.entityManager, AgentConversationEntity, "c", CONVERSATION_COLUMNS)
            .where("c.workspace_id = :workspaceId AND c.id = :conversationId AND c.kind = 'customer'", {
                workspaceId,
                conversationId,
            })
            .limit(1)
            .getRawMany<ConversationRow>()
        if (conversation === undefined)
            throw new AgentConversationsError({ code: AgentConversationsErrorCode.NotFound })
        const [messages, waiting, leads] = await Promise.all([
            readFrom(this.entityManager, AgentMessageEntity, "m", [
                "id",
                "conversation_id",
                "role",
                "author_kind",
                "author_name",
                "body",
                "created_at",
                "delivery_status",
                "delivery_error",
            ])
                .where("m.workspace_id = :workspaceId AND m.conversation_id = :conversationId", {
                    workspaceId,
                    conversationId,
                })
                .orderBy("m.created_at")
                .addOrderBy("m.id")
                .limit(500)
                .getRawMany<MessageRow>(),
            this.waiting(workspaceId),
            readFrom(this.entityManager, LeadEntity, "l", [
                "id",
                "contact_name",
                "company",
                "stage",
                "need",
                "phone",
                "email",
            ])
                .where("l.workspace_id = :workspaceId AND l.id = :leadId", {
                    workspaceId,
                    leadId: conversation.lead_id,
                })
                .limit(1)
                .getRawMany<LeadRow>(),
        ])
        const item = waiting.find((row) => waitingConversationId(row) === conversationId)
        const [staff] =
            item?.assigned_staff_id === undefined || item.assigned_staff_id === null
                ? []
                : await readFrom(this.entityManager, StaffEntity, "s", ["name"])
                      .where("s.workspace_id = :workspaceId AND s.id = :staffId", {
                          workspaceId,
                          staffId: item.assigned_staff_id,
                      })
                      .limit(1)
                      .getRawMany<ChatbotStaffRow>()
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
            readFrom(this.entityManager, AgentEntity, "a", ["module", "name"])
                .where("a.workspace_id = :workspaceId AND a.status = 'active'", { workspaceId })
                .orderBy("a.created_at")
                .limit(100)
                .getRawMany<LensRow>(),
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
            const installations = await readFrom(this.entityManager, ModuleInstallationEntity, "m", ["id", "agent_id"])
                .where("m.workspace_id = :workspaceId AND m.module_key = 'chatbot'", {
                    workspaceId: request.workspaceId,
                })
                .orderBy("m.created_at")
                .limit(100)
                .getRawMany<ChatbotInstallationRow>()
            const own = installations.find((row) => row.id === request.installationId)
            if (own === undefined) return []
            if (installations.length > 1) return own.agent_id === null ? [] : [own.agent_id]
        }
        const agents = await readFrom(this.entityManager, AgentEntity, "a", ["id"])
            .where("a.workspace_id = :workspaceId AND a.module = 'chatbot'", { workspaceId: request.workspaceId })
            .limit(100)
            .getRawMany<AgentIdRow>()
        return agents.map((agent) => agent.id)
    }

    /** The customer-reply work items waiting for a decision, oldest first. */
    private waiting(workspaceId: string): Promise<Array<WaitingRow>> {
        return readFrom(this.entityManager, WorkItemEntity, "w", [
            "id",
            "subject_id",
            "proposal",
            "assigned_staff_id",
            "created_at",
        ])
            .where("w.workspace_id = :workspaceId AND w.action = 'reply_customer' AND w.status = 'waiting_decision'", {
                workspaceId,
            })
            .orderBy("w.created_at")
            .limit(200)
            .getRawMany<WaitingRow>()
    }
}
