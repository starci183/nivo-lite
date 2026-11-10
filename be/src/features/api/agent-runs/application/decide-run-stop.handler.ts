import { Optional } from "@nestjs/common"
import { CommandHandler } from "@nestjs/cqrs"
import { StopDoorService, type StopDoorAnswer } from "@modules/domain/agent-threads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DecideRunStopCommand } from "./decide-run-stop.command"

/** The answer of an app that runs no thread: every run is the old engine's. */
const NO_THREADS: StopDoorAnswer = { outcome: "not_thread", stepKey: null }

@CommandHandler(DecideRunStopCommand)
/**
 * A person's decision on the stop of a thread run, from the card on /chat or the run page: the founder's words or one of the three
 * buttons, through the stop door (owner or manager only; a stop already resolved answers `stop_closed` and moves nothing).
 */
export class DecideRunStopHandler extends ICQRSHandler<DecideRunStopCommand, StopDoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        @Optional() private readonly stops?: StopDoorService,
    ) {
        super(logger)
    }

    protected override process(command: DecideRunStopCommand): Promise<StopDoorAnswer> {
        if (this.stops === undefined) return Promise.resolve(NO_THREADS)
        return this.stops.decide(command.params.principal.id, command.params.request)
    }
}
