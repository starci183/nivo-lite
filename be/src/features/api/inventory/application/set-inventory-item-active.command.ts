import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetInventoryItemActiveRequest } from "./set-inventory-item-active.contracts"

/** Asks for switch a catalogue item on or off. */
export class SetInventoryItemActiveCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetInventoryItemActiveRequest>) {
        super()
    }
}
