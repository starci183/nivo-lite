import { CommandHandler } from "@nestjs/cqrs"
import { TemplatePurchasesService } from "@modules/domain/template-marketplace"
import type { PayableOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { OrderTemplateListingCommand } from "./order-template-listing.command"

@CommandHandler(OrderTemplateListingCommand)
/** Orders a paid listing: the transfer to make through SePay, the same way as any other order. */
export class OrderTemplateListingHandler extends ICQRSHandler<OrderTemplateListingCommand, PayableOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplatePurchasesService,
    ) {
        super(logger)
    }

    protected override process(command: OrderTemplateListingCommand): Promise<PayableOrder> {
        return this.svc.order(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.listingId,
        )
    }
}
