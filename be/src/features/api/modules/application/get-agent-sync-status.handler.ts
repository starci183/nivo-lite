import { QueryHandler } from "@nestjs/cqrs"
import { ModuleInstallService } from "@modules/domain/modules"
import type { AgentSyncStatus } from "@modules/domain/module-installations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentSyncStatusQuery } from "./get-agent-sync-status.query"

@QueryHandler(GetAgentSyncStatusQuery)
/** Answers the sync status from the module install service. */
export class GetAgentSyncStatusHandler extends ICQRSHandler<GetAgentSyncStatusQuery, AgentSyncStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly installs: ModuleInstallService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentSyncStatusQuery): Promise<AgentSyncStatus> {
        return this.installs.syncStatus(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
