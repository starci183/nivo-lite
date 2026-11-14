import { CommandHandler } from "@nestjs/cqrs"
import { BrainFactDecisionService } from "@modules/domain/brain"
import type { FactRecord } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DecideBrainFactCommand } from "./decide-brain-fact.command"

@CommandHandler(DecideBrainFactCommand)
/** Applies, rejects, chooses, splits or retires a fact. */
export class DecideBrainFactHandler extends ICQRSHandler<DecideBrainFactCommand, FactRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decision: BrainFactDecisionService,
    ) {
        super(logger)
    }

    protected override process(command: DecideBrainFactCommand): Promise<FactRecord> {
        return this.decision.decide(command.params.principal.id, command.params.request)
    }
}
