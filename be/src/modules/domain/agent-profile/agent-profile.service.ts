import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentEntity, AgentOwnershipService } from "@modules/domain/agents"
import type { Region } from "@modules/domain/agents"
import { AuthorityRuleEntity } from "@modules/domain/authority-rules"
import { WorkItemEntity } from "@modules/domain/work-items"
import { LeadEntity } from "@modules/domain/leads"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentHead, AgentPage, AppliedRule, RecentWork } from "./agent-profile.contracts"
import { AgentProfileLogEvent } from "./agent-profile.log-events"
import { headOf, recentOf, ruleLineOf } from "./agent-profile.mapper"
import { AgentProfileError, AgentProfileErrorCode } from "./errors/agent-profile.error"
import type { AgentHeadRead, RecentWorkRead } from "./agent-profile-reads.contracts"

const RECENT_LIMIT = 6
const RULE_LIMIT = 50

/** The name of the agent's home room, and the mode of the instance that drives it (its oldest). */
const HOME_ROOM_NAME =
    "(SELECT r.name FROM public.office_rooms_members rm JOIN public.office_rooms r ON r.id = rm.room_id WHERE rm.agent_id = a.id AND rm.is_home LIMIT 1)"
const OPERATING_MODE =
    "(SELECT i.operating_mode FROM public.module_installations i WHERE i.agent_id = a.id ORDER BY i.created_at, i.id LIMIT 1)"

@Injectable()
/**
 * The page of one agent: its header, who answers for it, who may give it work, whom it may tag, the rules that apply to it and
 * its latest work. The ownership comes from the agents capability; the rules and the recent work are read on their own and fail
 * on their own, so a failed region never takes the page down.
 */
export class AgentProfileService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly agents: AgentOwnershipService,
    ) {}

    /** The page of an agent for a member of the workspace. */
    async page(userId: string, workspaceId: string, agentId: string): Promise<AgentPage> {
        const ownership = await this.agents.ownershipOf(userId, workspaceId, agentId)
        const row = await this.entityManager
            .createQueryBuilder(AgentEntity, "a")
            .select("a.id", "id")
            .addSelect("a.name", "name")
            .addSelect("a.handle", "handle")
            .addSelect("a.role", "role")
            .addSelect("a.module", "module")
            .addSelect("a.status", "status")
            .addSelect("a.avatarUrl", "avatarUrl")
            .addSelect(HOME_ROOM_NAME, "roomName")
            .addSelect(OPERATING_MODE, "operatingMode")
            .where("a.id = :agentId AND a.workspaceId = :workspaceId", { agentId, workspaceId })
            .limit(1)
            .getRawOne<AgentHeadRead>()
        if (row === undefined)
            throw new AgentProfileError({ code: AgentProfileErrorCode.AgentNotFound, params: { id: agentId } })
        const agent = headOf(row)
        const [rules, recent] = await Promise.all([
            this.settle("rules", () => this.rulesOf(workspaceId, agent)),
            this.settle("recent", () => this.recentOf(workspaceId, agent)),
        ])
        return { agent, ownership, rules, recent }
    }

    private async rulesOf(workspaceId: string, agent: AgentHead): Promise<ReadonlyArray<AppliedRule>> {
        const rows = await this.entityManager.find(AuthorityRuleEntity, {
            where: { workspaceId, department: agent.module },
            order: { action: "ASC" },
            take: RULE_LIMIT,
        })
        return rows.map(ruleLineOf)
    }

    private async recentOf(workspaceId: string, agent: AgentHead): Promise<ReadonlyArray<RecentWork>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect("to_json(COALESCE(w.completed_at, w.updated_at)) #>> '{}'", "at")
            .addSelect("COALESCE(NULLIF(w.result->>'summary', ''), w.proposal->>'summary')", "summary")
            .addSelect("COALESCE(l.contact_name, w.proposal->'fields'->>'customer')", "customer")
            .addSelect("w.leadId", "leadId")
            .leftJoin(LeadEntity, "l", "l.id = w.lead_id")
            .where("w.workspaceId = :workspaceId AND w.department = :department", {
                workspaceId,
                department: agent.module,
            })
            .orderBy("COALESCE(w.completed_at, w.updated_at)", "DESC")
            .addOrderBy("w.id", "ASC")
            .limit(RECENT_LIMIT)
            .getRawMany<RecentWorkRead>()
        return rows.map(recentOf)
    }

    private async settle<T>(region: string, read: () => Promise<T>): Promise<Region<T>> {
        try {
            return { ok: true, data: await read() }
        } catch (cause) {
            this.logger.error(AgentProfileLogEvent.RegionFailed, cause, { region })
            return { ok: false }
        }
    }
}
