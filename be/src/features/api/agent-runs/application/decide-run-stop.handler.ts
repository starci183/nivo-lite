import { CommandHandler } from "@nestjs/cqrs"
import { RunStopDecisionsService } from "@modules/domain/agent-pages"
import type { StopDoorAnswer } from "@modules/domain/agent-threads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DecideRunStopCommand } from "./decide-run-stop.command"

@CommandHandler(DecideRunStopCommand)
/**
 * A person's decision on the stop of a thread run, from the card on /chat or the run page: the founder's words or one of the three
 * buttons, through the stop door (owner or manager only; a stop already resolved answers `stop_closed` and moves nothing).
 */
export class DecideRunStopHandler extends ICQRSHandler<DecideRunStopCommand, StopDoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: RunStopDecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: DecideRunStopCommand): Promise<StopDoorAnswer> {
        return this.decisions.decide(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.runId,
            command.params.request.stepKey,
            command.params.request.action,
            command.params.request.text,
        )
    }
}
