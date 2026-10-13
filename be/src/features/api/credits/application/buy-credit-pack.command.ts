import { Command } from "@nestjs/cqrs"
import type { PayableOrder } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BuyCreditPackRequest } from "./buy-credit-pack.contracts"

/** Asks for a pending top-up order for one credit pack. */
export class BuyCreditPackCommand extends Command<PayableOrder> {
    constructor(readonly params: ExecuteParams<BuyCreditPackRequest>) {
        super()
    }
}
