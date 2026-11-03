import { Command } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { OrderTemplateListingRequest } from "./order-template-listing.contracts"

/** Orders a paid listing: the transfer to make through SePay, the same way as any other order. */
export class OrderTemplateListingCommand extends Command<PayableOrder> {
    constructor(readonly params: ExecuteParams<OrderTemplateListingRequest>) {
        super()
    }
}
