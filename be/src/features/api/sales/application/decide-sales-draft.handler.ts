import { CommandHandler } from "@nestjs/cqrs"
import { SalesDecisionsService } from "@modules/domain/sales"
import type { SalesAction } from "@modules/domain/sales"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecideSalesDraftCommand } from "./decide-sales-draft.command"

@CommandHandler(DecideSalesDraftCommand)
/** Queues a person's decision on a Sales draft. */
export class DecideSalesDraftHandler extends ICQRSHandler<DecideSalesDraftCommand, SalesAction> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesDecisionsService,
    ) {
        super(logger)
    }

    protected override process(command: DecideSalesDraftCommand): Promise<SalesAction> {
        return this.sales.decideDraft(command.params.principal.id, command.params.request)
    }
}
