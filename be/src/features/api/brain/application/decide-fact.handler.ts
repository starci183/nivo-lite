import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { FactRecord } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideFactCommand } from "./decide-fact.command"

@CommandHandler(DecideFactCommand)
/** Applies the decision through the brain service. */
export class DecideFactHandler extends ICQRSHandler<DecideFactCommand, FactRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DecideFactCommand): Promise<FactRecord> {
        return this.brain.decideFact(command.params.principal.id, command.params.request)
    }
}
