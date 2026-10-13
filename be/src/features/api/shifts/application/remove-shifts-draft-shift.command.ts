import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveShiftsDraftShiftRequest } from "./remove-shifts-draft-shift.contracts"

/** Asks for remove a shift from a draft schedule. */
export class RemoveShiftsDraftShiftCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RemoveShiftsDraftShiftRequest>) {
        super()
    }
}
