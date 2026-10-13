import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AddShiftsDraftShiftRequest } from "./add-shifts-draft-shift.contracts"

/** Asks for add a shift to a draft schedule. */
export class AddShiftsDraftShiftCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<AddShiftsDraftShiftRequest>) {
        super()
    }
}
