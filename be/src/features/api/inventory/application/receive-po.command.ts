import { Command } from "@nestjs/cqrs"
import type { ReceivePoOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReceivePoRequest } from "./receive-po.contracts"

/** Asks to receive goods against a purchase order. */
export class ReceivePoCommand extends Command<ReceivePoOutput> {
    constructor(readonly params: ExecuteParams<ReceivePoRequest>) {
        super()
    }
}
