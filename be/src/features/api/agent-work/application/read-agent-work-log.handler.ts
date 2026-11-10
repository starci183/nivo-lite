import { QueryHandler } from "@nestjs/cqrs"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { logLineOf } from "./agent-work-log.policy"
import { ReadAgentWorkLogQuery } from "./read-agent-work-log.query"
import type { WorkLogLine } from "./read-agent-work-log.contracts"

/** The work items the log lists. */
const LOG_LINES = 100

@QueryHandler(ReadAgentWorkLogQuery)
/** Answers the work log of one agent to an owner or manager: its newest work items, each with how it was decided and what backs it. */
export class ReadAgentWorkLogHandler extends ICQRSHandler<ReadAgentWorkLogQuery, ReadonlyArray<WorkLogLine>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly installations: InstallationRecordsService,
        private readonly items: WorkItemsViewsReadService,
        private readonly bindings: AgentBindingsService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadAgentWorkLogQuery): Promise<ReadonlyArray<WorkLogLine>> {
        const { workspaceId, installationId } = query.params.request
        const userId = query.params.principal.id
        await this.access.manager(userId, workspaceId)
        const installation = await this.installations.find(workspaceId, installationId)
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
