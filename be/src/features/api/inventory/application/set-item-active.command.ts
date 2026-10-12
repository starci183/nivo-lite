import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetItemActiveRequest } from "./set-item-active.contracts"

/** Asks to switch an item on or off. */
export class SetItemActiveCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetItemActiveRequest>) {
        super()
    }
}
