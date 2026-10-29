import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReactToOrderConfirmedRequest } from "./react-to-order-confirmed.contracts"

/** Asks to apply one delivered order_confirmed event; the order_confirmed consumer sends it for every delivery. */
export class ReactToOrderConfirmedCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ReactToOrderConfirmedRequest>) {
        super()
    }
}
