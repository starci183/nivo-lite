import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DismissGapRequest } from "./dismiss-gap.contracts"

/** Asks to dismiss a customer question the owner does not need answered. */
export class DismissGapCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DismissGapRequest>) {
        super()
    }
}
