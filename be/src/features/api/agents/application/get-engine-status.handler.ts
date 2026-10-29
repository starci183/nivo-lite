import { QueryHandler } from "@nestjs/cqrs"
import { EngineStatusService } from "@modules/domain/agents"
import type { EngineStatus } from "@modules/domain/agents"
import { AgentSyncChecksService } from "@modules/domain/openclaw-agent-sync"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetEngineStatusQuery } from "./get-engine-status.query"

@QueryHandler(GetEngineStatusQuery)
/** Answers the engine status from the engine status service. */
export class GetEngineStatusHandler extends ICQRSHandler<GetEngineStatusQuery, EngineStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly engine: EngineStatusService,
        private readonly syncChecks: AgentSyncChecksService,
    ) {
        super(logger)
    }

    protected override process(query: GetEngineStatusQuery): Promise<EngineStatus> {
        const { workspaceId } = query.params.request
        return this.engine.status(query.params.principal.id, workspaceId, () =>
            this.syncChecks.lastCheckAt(workspaceId),
        )
    }
}
