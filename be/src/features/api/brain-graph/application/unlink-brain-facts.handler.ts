import { CommandHandler } from "@nestjs/cqrs"
import { BrainGraphService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UnlinkBrainFactsCommand } from "./unlink-brain-facts.command"

@CommandHandler(UnlinkBrainFactsCommand)
/** Removes an edge of the truth graph. */
export class UnlinkBrainFactsHandler extends ICQRSHandler<UnlinkBrainFactsCommand, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly graphs: BrainGraphService,
    ) {
        super(logger)
    }

    protected override process(command: UnlinkBrainFactsCommand): Promise<boolean> {
        return this.graphs.unlink(command.params.principal.id, command.params.request)
    }
}
