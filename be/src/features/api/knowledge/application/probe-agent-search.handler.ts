import { QueryHandler } from "@nestjs/cqrs"
import { BrainProbeService, type BrainProbeAnswer } from "@modules/domain/native-tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ProbeAgentSearchQuery } from "./probe-agent-search.query"

@QueryHandler(ProbeAgentSearchQuery)
/** Runs one Brain read tool as an agent, through the tool's own code and with no model turn; the workspace owner alone may. */
export class ProbeAgentSearchHandler extends ICQRSHandler<ProbeAgentSearchQuery, BrainProbeAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly probe: BrainProbeService,
    ) {
        super(logger)
    }

    protected override process(query: ProbeAgentSearchQuery): Promise<BrainProbeAnswer> {
        return this.probe.run(query.params.principal.id, query.params.request.workspaceId, query.params.request)
    }
}
