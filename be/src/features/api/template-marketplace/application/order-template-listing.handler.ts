import { CommandHandler } from "@nestjs/cqrs"
import { TemplatePurchasesService } from "@modules/domain/template-marketplace"
import type { PayableOrder } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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
        const p = command.params.principal.id
        const r = command.params.request
        return this.svc.order(p, r.workspaceId, r.listingId)
    }
}
