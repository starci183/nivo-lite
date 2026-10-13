import { Query } from "@nestjs/cqrs"
import type { InventoryTemplateInfo } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { InventoryTemplatesRequest } from "./inventory-templates.contracts"

/** Asks for the starter sets a new shop can pick. */
export class InventoryTemplatesQuery extends Query<ReadonlyArray<InventoryTemplateInfo>> {
    constructor(readonly params: ExecuteParams<InventoryTemplatesRequest>) {
        super()
    }
}
