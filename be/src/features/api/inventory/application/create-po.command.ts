import { Command } from "@nestjs/cqrs"
import type { CreatePoOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreatePoRequest } from "./create-po.contracts"

/** Asks to create a purchase order. */
export class CreatePoCommand extends Command<CreatePoOutput> {
    constructor(readonly params: ExecuteParams<CreatePoRequest>) {
        super()
    }
}
