import { CommandHandler } from "@nestjs/cqrs"
import { BrainGraphService } from "@modules/domain/brain"
import type { FactRelation } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { LinkBrainFactsCommand } from "./link-brain-facts.command"

@CommandHandler(LinkBrainFactsCommand)
/** Draws an edge between two truths. */
export class LinkBrainFactsHandler extends ICQRSHandler<LinkBrainFactsCommand, FactRelation> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly graphs: BrainGraphService,
    ) {
        super(logger)
    }

    protected override process(command: LinkBrainFactsCommand): Promise<FactRelation> {
        return this.graphs.link(command.params.principal.id, command.params.request)
    }
}
