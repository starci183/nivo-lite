import { Injectable } from "@nestjs/common"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { logLineOf } from "./agent-work-log.policy"
import type { WorkLogLine } from "./agent-work-log.contracts"

/** The work items the log lists. */
const LOG_LINES = 100

@Injectable()
/** The work log of one agent: its newest work items, each with how it was decided and what backs it. */
export class AgentWorkLogService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly items: WorkItemsViewsReadService,
        private readonly bindings: AgentBindingsService,
    ) {}

    /** The log of the agent instance to an owner or manager; empty when the workspace holds no such instance. */
    async lines(userId: string, workspaceId: string, installationId: string): Promise<ReadonlyArray<WorkLogLine>> {
        const installation = await this.access.managedInstallation(userId, workspaceId, installationId)
        if (installation === null) return []
        const [items, grants] = await Promise.all([
            this.items.ofInstallation(workspaceId, installationId, LOG_LINES),
            installation.agentId === null
                ? Promise.resolve([])
                : this.bindings.connectionsOfAgent(userId, workspaceId, installation.agentId),
        ])
        return items.map((item) => logLineOf(item, grants))
    }
}
