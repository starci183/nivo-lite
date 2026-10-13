import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CancelInventoryPoRequest } from "./cancel-inventory-po.contracts"

/** Asks for cancel a purchase order. */
export class CancelInventoryPoCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<CancelInventoryPoRequest>) {
        super()
    }
}
