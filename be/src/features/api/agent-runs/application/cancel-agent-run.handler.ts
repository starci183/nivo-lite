import { Optional } from "@nestjs/common"
import { CommandHandler } from "@nestjs/cqrs"
import { AgentRunCancelService } from "@modules/domain/agent-runs"
import type { OwnerCancelAnswer } from "@modules/domain/agent-runs"
import { StopDoorService } from "@modules/domain/agent-threads/stops"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelAgentRunCommand } from "./cancel-agent-run.command"

@CommandHandler(CancelAgentRunCommand)
/**
 * Stops a run through the owner door of the agent runs; in an app that runs threads, through the stop door, which hands a run on a
 * LangGraph thread to its stop's `skip` (a stop already resolved moves nothing).
 */
export class CancelAgentRunHandler extends ICQRSHandler<CancelAgentRunCommand, OwnerCancelAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly cancels: AgentRunCancelService,
        @Optional() private readonly stops?: StopDoorService,
    ) {
        super(logger)
    }

    protected override process(command: CancelAgentRunCommand): Promise<OwnerCancelAnswer> {
        const request = { principalId: command.params.principal.id, ...command.params.request }
        return this.stops === undefined ? this.cancels.cancel(request) : this.stops.cancelRun(request)
    }
}
