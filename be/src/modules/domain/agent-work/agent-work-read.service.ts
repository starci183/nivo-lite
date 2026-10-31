import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentGoalsService } from "./agent-goals.service"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentTriggersService } from "./agent-triggers.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkSettingsService } from "./agent-work-settings.service"
import { toTurnRecord } from "./agent-work.mapper"
import { wakeProgressOf } from "./agent-work.policy"
import { AgentTurnEntity, AgentWakeEntity, AgentWorkStateEntity } from "./persistence/entities"
import type {
    AgentTurnRecord,
    AgentWorkView,
    OptionalCustomerWakeProgress,
    OptionalWakeSource,
    WorkspaceAgentWorkView,
} from "./agent-work.contracts"

/** The turns the work tab lists. */
const RECENT_TURNS = 20

@Injectable()
/**
 * What the work tab reads: the state, goals, tasks, triggers and recent turns of one agent, and the counts of a workspace. A turn is
 * listed with its source, outcome, usage and time, never its prompt, its proposal or a customer's words. The caller proves the member.
 */
export class AgentWorkReadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly access: AgentWorkAccessService,
        private readonly settings: AgentWorkSettingsService,
        private readonly goals: AgentGoalsService,
        private readonly tasks: AgentTasksService,
        private readonly triggers: AgentTriggersService,
    ) {}

    /** The source that woke the agent, or null when the wake is gone. */
    async wakeSourceOf(workspaceId: string, wakeId: string): Promise<OptionalWakeSource> {
        const wake = await this.entityManager.findOne(AgentWakeEntity, {
            select: { source: true },
            where: { id: wakeId, workspaceId },
        })
        return wake?.source ?? null
    }

    /** The work of one agent of the workspace. */
    async agentWork(workspaceId: string, agentId: string): Promise<AgentWorkView> {
        await this.access.agent(workspaceId, agentId)
        const [state, goals, tasks, triggers, turns, pendingWakes] = await Promise.all([
            this.settings.stateOf(agentId),
            this.goals.alive(agentId),
            this.tasks.alive(agentId),
            this.triggers.ofAgent(agentId),
            this.recentTurns(agentId),
            this.entityManager.count(AgentWakeEntity, { where: { agentId, status: "pending" } }),
        ])
        return { state, goals, tasks, triggers, turns, pendingWakes }
    }

    /** The workspace-wide switch with the counts beside it. */
    async workspaceWork(workspaceId: string): Promise<WorkspaceAgentWorkView> {
        const [settings, agentsOff, pendingWakes, heldWakes] = await Promise.all([
            this.settings.settingsOf(workspaceId),
            this.entityManager.count(AgentWorkStateEntity, { where: { workspaceId, workEnabled: false } }),
            this.entityManager.count(AgentWakeEntity, { where: { workspaceId, status: "pending" } }),
            this.entityManager.count(AgentWakeEntity, { where: { workspaceId, status: "held" } }),
        ])
        return { settings, agentsOff, pendingWakes, heldWakes }
    }

    /** Where the customer wake of a stored message stands, or null when none was written for it (the message took the legacy road). */
    async customerWake(workspaceId: string, messageId: string): Promise<OptionalCustomerWakeProgress> {
        const wake = await this.entityManager.findOne(AgentWakeEntity, {
            where: { workspaceId, source: "customer", eventKey: messageId },
        })
        return wake === null ? null : { id: wake.id, state: wakeProgressOf(wake.status) }
    }

    private async recentTurns(agentId: string): Promise<ReadonlyArray<AgentTurnRecord>> {
        const turns = await this.entityManager.find(AgentTurnEntity, {
            where: { agentId },
            order: { createdAt: "DESC" },
            take: RECENT_TURNS,
        })
        if (turns.length === 0) return []
        const wakes = await this.entityManager.find(AgentWakeEntity, {
            where: { id: In(turns.map((turn) => turn.wakeId)) },
            take: RECENT_TURNS,
        })
        const byId = new Map(wakes.map((wake) => [wake.id, wake] as const))
        return turns.flatMap((turn) => {
            const wake = byId.get(turn.wakeId)
            return wake === undefined ? [] : [toTurnRecord(turn, wake)]
        })
    }
}
