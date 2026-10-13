import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import type { ProposeResult } from "@modules/domain/brain-facts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveBrainFactCommand } from "./save-brain-fact.command"

@CommandHandler(SaveBrainFactCommand)
/** Writes a fact, or a new value for an existing one; it is applied at once. */
export class SaveBrainFactHandler extends ICQRSHandler<SaveBrainFactCommand, ProposeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBrainFactCommand): Promise<ProposeResult> {
        return this.brain.saveFact(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
