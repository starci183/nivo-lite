import { Command } from "@nestjs/cqrs"
import type { ReceivePoOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReceiveInventoryPoRequest } from "./receive-inventory-po.contracts"

/** Asks for receive goods against a purchase order. */
export class ReceiveInventoryPoCommand extends Command<ReceivePoOutput> {
    constructor(readonly params: ExecuteParams<ReceiveInventoryPoRequest>) {
        super()
    }
}
