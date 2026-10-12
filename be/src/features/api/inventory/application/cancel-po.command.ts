import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CancelPoRequest } from "./cancel-po.contracts"

/** Asks to cancel a purchase order. */
export class CancelPoCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<CancelPoRequest>) {
        super()
    }
}
