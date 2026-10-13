import { Command } from "@nestjs/cqrs"
import type { ApplyStarterOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplyInventoryStarterRequest } from "./apply-inventory-starter.contracts"

/** Asks for load one starter set of suppliers, items and recipes. */
export class ApplyInventoryStarterCommand extends Command<ApplyStarterOutput> {
    constructor(readonly params: ExecuteParams<ApplyInventoryStarterRequest>) {
        super()
    }
}
