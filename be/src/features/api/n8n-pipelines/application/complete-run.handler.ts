import { CommandHandler } from "@nestjs/cqrs"
import { N8nDoorService } from "@modules/domain/n8n-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CompleteRunCommand } from "./complete-run.command"

@CommandHandler(CompleteRunCommand)
/** Closes the run with how it ended. */
export class CompleteRunHandler extends ICQRSHandler<CompleteRunCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: N8nDoorService,
    ) {
        super(logger)
    }

    protected override process(message: CompleteRunCommand): Promise<void> {
        return this.door.completeRun(
            message.params.request.authorization,
            message.params.request.runId,
            message.params.request.report,
        )
    }
}
