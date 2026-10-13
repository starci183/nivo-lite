import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { FactRecord } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideBrainFactCommand } from "./decide-brain-fact.command"

@CommandHandler(DecideBrainFactCommand)
/** Applies, rejects, chooses, splits or retires a fact. */
export class DecideBrainFactHandler extends ICQRSHandler<DecideBrainFactCommand, FactRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DecideBrainFactCommand): Promise<FactRecord> {
        return this.brain.decideFact(command.params.principal.id, command.params.request)
    }
}
