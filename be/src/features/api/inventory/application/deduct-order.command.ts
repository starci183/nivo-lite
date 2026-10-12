import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeductOrderRequest } from "./deduct-order.contracts"

/** Asks to take a confirmed order out of stock. */
export class DeductOrderCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeductOrderRequest>) {
        super()
    }
}
