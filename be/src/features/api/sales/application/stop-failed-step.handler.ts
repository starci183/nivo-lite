import { CommandHandler } from "@nestjs/cqrs"
import { SalesWorkService } from "@modules/domain/sales"
import type { WorkItem } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StopFailedStepCommand } from "./stop-failed-step.command"

@CommandHandler(StopFailedStepCommand)
/** Stops one failed Sales step. */
export class StopFailedStepHandler extends ICQRSHandler<StopFailedStepCommand, WorkItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesWorkService,
    ) {
        super(logger)
    }

    protected override process(command: StopFailedStepCommand): Promise<WorkItem> {
        return this.sales.stop(command.params.principal.id, command.params.request)
    }
}
