import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KeepCurrentBrainFactCommand } from "./keep-current-brain-fact.command"

@CommandHandler(KeepCurrentBrainFactCommand)
/** Keeps the value in force and rejects every waiting value of its key. */
export class KeepCurrentBrainFactHandler extends ICQRSHandler<KeepCurrentBrainFactCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: KeepCurrentBrainFactCommand): Promise<number> {
        return this.brain.keepCurrent(command.params.principal.id, command.params.request)
    }
}
