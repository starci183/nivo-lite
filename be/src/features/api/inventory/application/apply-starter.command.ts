import { Command } from "@nestjs/cqrs"
import type { ApplyStarterOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplyStarterRequest } from "./apply-starter.contracts"

/** Asks to load a starter set of suppliers, items and recipes. */
export class ApplyStarterCommand extends Command<ApplyStarterOutput> {
    constructor(readonly params: ExecuteParams<ApplyStarterRequest>) {
        super()
    }
}
