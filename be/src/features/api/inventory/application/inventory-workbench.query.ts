import { Query } from "@nestjs/cqrs"
import type { InventoryWorkbenchView } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { InventoryWorkbenchRequest } from "./inventory-workbench.contracts"

/** Asks for the whole inventory workbench of the caller's workspace. */
export class InventoryWorkbenchQuery extends Query<InventoryWorkbenchView> {
    constructor(readonly params: ExecuteParams<InventoryWorkbenchRequest>) {
        super()
    }
}
