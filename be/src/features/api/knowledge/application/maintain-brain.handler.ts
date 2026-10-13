import { CommandHandler } from "@nestjs/cqrs"
import { BrainService } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MaintainBrainCommand } from "./maintain-brain.command"

@CommandHandler(MaintainBrainCommand)
/** Keeps the brain current: scheduled values take over and ended values expire. */
export class MaintainBrainHandler extends ICQRSHandler<MaintainBrainCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly brain: BrainService,
    ) {
        super(logger)
    }

    protected override process(command: MaintainBrainCommand): Promise<void> {
        return this.brain.maintain(command.params.principal.id, command.params.request.workspaceId)
    }
}
