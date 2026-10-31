import { Injectable } from "@nestjs/common"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { AgentGoalsService } from "./agent-goals.service"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentTriggersService } from "./agent-triggers.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkReadService } from "./agent-work-read.service"
import { AgentWorkSettingsService } from "./agent-work-settings.service"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type {
    AgentGoalDraft,
    AgentGoalRecord,
    AgentTriggerDraft,
    AgentTriggerRecord,
    AgentWorkSettingsRecord,
    AgentWorkState,
    AgentWorkView,
    WorkspaceAgentWorkView,
} from "./agent-work.contracts"

@Injectable()
/**
 * The doors of the Work tab, one per thing the tab does. Each proves the caller's role in the workspace they name first (an owner for the
 * two switches, an owner or manager for the rest, staff for nothing), then proves the agent instance belongs to that workspace and drives
 * an agent: an id from another workspace is as unknown as an id nobody holds. Only then does it hand over to the service that owns the data.
 */
export class AgentWorkDoorsService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly installations: InstallationRecordsService,
        private readonly read: AgentWorkReadService,
        private readonly settings: AgentWorkSettingsService,
        private readonly goals: AgentGoalsService,
        private readonly triggers: AgentTriggersService,
        private readonly tasks: AgentTasksService,
    ) {}

    /** The Work tab of the agent of an instance. */
    async agentWork(userId: string, workspaceId: string, installationId: string): Promise<AgentWorkView> {
        return this.read.agentWork(workspaceId, await this.managedAgentOf(userId, workspaceId, installationId))
    }

    /** The switch of the whole workspace with the counts beside it. */
    async workspaceWork(userId: string, workspaceId: string): Promise<WorkspaceAgentWorkView> {
        await this.access.manager(userId, workspaceId)
        return this.read.workspaceWork(workspaceId)
    }

    /** Switches work on or off for the agent of an instance. Owner only. */
    async setAgentWork(
        userId: string,
        workspaceId: string,
        installationId: string,
        enabled: boolean,
    ): Promise<AgentWorkState> {
        await this.access.owner(userId, workspaceId)
        const agentId = await this.agentOf(workspaceId, installationId)
        return this.settings.setAgentWork(userId, workspaceId, agentId, enabled)
    }

    /** Switches work on or off for every agent of the workspace. Owner only. */
    setWorkspaceWork(userId: string, workspaceId: string, enabled: boolean): Promise<AgentWorkSettingsRecord> {
        return this.settings.setWorkspaceWork(userId, workspaceId, enabled)
    }

    /** Adds a goal to the agent of an instance, or changes one; the owner is its source. */
    async saveGoal(userId: string, draft: AgentGoalDraft): Promise<AgentGoalRecord> {
        const agentId = await this.managedAgentOf(userId, draft.workspaceId, draft.installationId)
        return this.goals.save(userId, {
            workspaceId: draft.workspaceId,
            agentId,
            goalId: draft.goalId,
            title: draft.title,
            detail: draft.detail,
            status: draft.status,
            source: "owner",
            memberId: null,
            dueAt: draft.dueAt,
        })
    }

    /** Adds a trigger to the agent of an instance, or changes one. */
    async saveTrigger(userId: string, draft: AgentTriggerDraft): Promise<AgentTriggerRecord> {
        const agentId = await this.managedAgentOf(userId, draft.workspaceId, draft.installationId)
        return this.triggers.save(userId, { ...draft, agentId })
    }

    /** Removes a trigger of the agent of an instance. */
    async removeTrigger(userId: string, workspaceId: string, installationId: string, triggerId: string): Promise<void> {
        const agentId = await this.managedAgentOf(userId, workspaceId, installationId)
        await this.triggers.remove(userId, workspaceId, agentId, triggerId)
    }

    /** Closes a task of the agent of an instance. */
    async closeTask(userId: string, workspaceId: string, installationId: string, taskId: string): Promise<void> {
        const agentId = await this.managedAgentOf(userId, workspaceId, installationId)
        await this.tasks.drop(userId, workspaceId, agentId, taskId)
    }

    /** Proves the caller is an owner or manager of the workspace, then the agent of the instance. */
    private async managedAgentOf(userId: string, workspaceId: string, installationId: string): Promise<string> {
        await this.access.manager(userId, workspaceId)
        return this.agentOf(workspaceId, installationId)
    }

    private async agentOf(workspaceId: string, installationId: string): Promise<string> {
        const installation = await this.installations.find(workspaceId, installationId)
        const agentId = installation?.agentId ?? null
        if (agentId === null) throw new AgentWorkError({ code: AgentWorkErrorCode.AgentNotFound })
        return agentId
    }
}
