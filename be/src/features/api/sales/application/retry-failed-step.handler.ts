import { CommandHandler } from "@nestjs/cqrs"
import { SalesWorkService } from "@modules/domain/sales"
import type { SalesAction } from "@modules/domain/sales"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RetryFailedStepCommand } from "./retry-failed-step.command"

@CommandHandler(RetryFailedStepCommand)
/** Queues a retry of one failed Sales step. */
export class RetryFailedStepHandler extends ICQRSHandler<RetryFailedStepCommand, SalesAction> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesWorkService,
    ) {
        super(logger)
    }

    protected override process(command: RetryFailedStepCommand): Promise<SalesAction> {
        return this.sales.reopenFailedStep(command.params.principal.id, command.params.request)
    }
}
