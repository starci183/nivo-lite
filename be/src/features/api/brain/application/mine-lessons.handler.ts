import { CommandHandler } from "@nestjs/cqrs"
import { BrainLearningService } from "@modules/domain/brain"
import type { MineResult } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MineLessonsCommand } from "./mine-lessons.command"

@CommandHandler(MineLessonsCommand)
/** Studies the corrections through the learning service. */
export class MineLessonsHandler extends ICQRSHandler<MineLessonsCommand, MineResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly learning: BrainLearningService,
    ) {
        super(logger)
    }

    protected override process(command: MineLessonsCommand): Promise<MineResult> {
        return this.learning.mine(command.params.principal.id, command.params.request.workspaceId, command.params.request.module)
    }
}
