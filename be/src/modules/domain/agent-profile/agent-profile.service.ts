import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentOwnershipService } from "@modules/domain/agents"
import type { Region } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentHead, AgentPage, AppliedRule, RecentWork } from "./agent-profile.contracts"
import { AgentProfileLogEvent } from "./agent-profile.log-events"
import { headOf, recentOf, ruleLineOf } from "./agent-profile.mapper"
import { AgentProfileError, AgentProfileErrorCode } from "./errors/agent-profile.error"
import type { AgentHeadRow, AppliedRuleRow, RecentWorkRow } from "./persistence/agent-profile.rows"
import { FIND_AGENT_HEAD, LIST_APPLIED_RULES, LIST_RECENT_WORK } from "./persistence/agent-profile.sql"

const RECENT_LIMIT = 6

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
        const [row] = await this.entityManager.query<Array<AgentHeadRow>>(FIND_AGENT_HEAD, [agentId, workspaceId])
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
        const rows = await this.entityManager.query<Array<AppliedRuleRow>>(LIST_APPLIED_RULES, [
            workspaceId,
            agent.module,
        ])
        return rows.map(ruleLineOf)
    }

    private async recentOf(workspaceId: string, agent: AgentHead): Promise<ReadonlyArray<RecentWork>> {
        const rows = await this.entityManager.query<Array<RecentWorkRow>>(LIST_RECENT_WORK, [
            workspaceId,
            agent.module,
            RECENT_LIMIT,
        ])
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
