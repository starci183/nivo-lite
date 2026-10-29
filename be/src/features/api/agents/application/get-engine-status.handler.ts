import { QueryHandler } from "@nestjs/cqrs"
import type { EngineStatus } from "@modules/domain/agents"
import { AgentSyncChecksService } from "@modules/domain/openclaw-agent-sync"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetEngineStatusQuery } from "./get-engine-status.query"

@QueryHandler(GetEngineStatusQuery)
/** Answers the engine status from the sync checks service, which reads the engine status with the check time. */
export class GetEngineStatusHandler extends ICQRSHandler<GetEngineStatusQuery, EngineStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly syncChecks: AgentSyncChecksService,
    ) {
        super(logger)
    }

    protected override process(query: GetEngineStatusQuery): Promise<EngineStatus> {
        return this.syncChecks.engineStatus(query.params.principal.id, query.params.request.workspaceId)
    }
}
