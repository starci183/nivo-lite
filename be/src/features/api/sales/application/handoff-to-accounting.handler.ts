import { CommandHandler } from "@nestjs/cqrs"
import { SalesWorkService } from "@modules/domain/sales"
import type { SalesAction } from "@modules/domain/sales"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HandoffToAccountingCommand } from "./handoff-to-accounting.command"

@CommandHandler(HandoffToAccountingCommand)
/** Queues a Sales handoff to Accounting. */
export class HandoffToAccountingHandler extends ICQRSHandler<HandoffToAccountingCommand, SalesAction> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesWorkService,
    ) {
        super(logger)
    }

    protected override process(command: HandoffToAccountingCommand): Promise<SalesAction> {
        return this.sales.handoff(command.params.principal.id, command.params.request)
    }
}
