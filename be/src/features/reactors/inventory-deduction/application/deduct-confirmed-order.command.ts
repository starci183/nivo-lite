import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { DeductConfirmedOrderRequest } from "./deduct-confirmed-order.contracts"

/** Asks to apply one delivered order_confirmed event; the order_confirmed consumer sends it for every delivery. */
export class DeductConfirmedOrderCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<DeductConfirmedOrderRequest>) {
        super()
    }
}
