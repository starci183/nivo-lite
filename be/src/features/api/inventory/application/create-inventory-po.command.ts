import { Command } from "@nestjs/cqrs"
import type { CreatePoOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateInventoryPoRequest } from "./create-inventory-po.contracts"

/** Asks for create a draft purchase order. */
export class CreateInventoryPoCommand extends Command<CreatePoOutput> {
    constructor(readonly params: ExecuteParams<CreateInventoryPoRequest>) {
        super()
    }
}
