import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReactToOrderShippedRequest } from "./react-to-order-shipped.contracts"

/** Asks to apply one delivered order_shipped event; the order_shipped consumer sends it for every delivery. */
export class ReactToOrderShippedCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ReactToOrderShippedRequest>) {
        super()
    }
}
