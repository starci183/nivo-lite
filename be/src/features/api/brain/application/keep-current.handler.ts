import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KeepCurrentCommand } from "./keep-current.command"

@CommandHandler(KeepCurrentCommand)
/** Rejects the waiting values through the brain service. */
export class KeepCurrentHandler extends ICQRSHandler<KeepCurrentCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: KeepCurrentCommand): Promise<number> {
        return this.brain.keepCurrent(command.params.principal.id, command.params.request)
    }
}
