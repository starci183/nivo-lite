import { CommandHandler } from "@nestjs/cqrs"
import { SalesDecisionsService } from "@modules/domain/sales"
import type { SalesAction } from "@modules/domain/sales"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideSalesWorkItemCommand } from "./decide-sales-work-item.command"

@CommandHandler(DecideSalesWorkItemCommand)
/** Queues a person's decision on a Sales proposal. */
export class DecideSalesWorkItemHandler extends ICQRSHandler<DecideSalesWorkItemCommand, SalesAction> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesDecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: DecideSalesWorkItemCommand): Promise<SalesAction> {
        return this.sales.decideWorkItem(command.params.principal.id, command.params.request)
    }
}
