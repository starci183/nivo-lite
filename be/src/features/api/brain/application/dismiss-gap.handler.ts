import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DismissGapCommand } from "./dismiss-gap.command"

@CommandHandler(DismissGapCommand)
/** Dismisses the gap through the brain service. */
export class DismissGapHandler extends ICQRSHandler<DismissGapCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: DismissGapCommand): Promise<void> {
        return this.brain.dismissGap(command.params.principal.id, command.params.request.workspaceId, command.params.request.id)
    }
}
