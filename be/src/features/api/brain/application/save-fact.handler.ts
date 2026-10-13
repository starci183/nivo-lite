import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { ProposeResult } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveFactCommand } from "./save-fact.command"

@CommandHandler(SaveFactCommand)
/** Saves the fact through the brain service. */
export class SaveFactHandler extends ICQRSHandler<SaveFactCommand, ProposeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: SaveFactCommand): Promise<ProposeResult> {
        return this.brain.saveFact(command.params.principal.id, command.params.request.workspaceId, command.params.request)
    }
}
