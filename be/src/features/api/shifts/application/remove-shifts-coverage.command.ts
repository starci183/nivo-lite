import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveShiftsCoverageRequest } from "./remove-shifts-coverage.contracts"

/** Asks for remove a coverage block. */
export class RemoveShiftsCoverageCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RemoveShiftsCoverageRequest>) {
        super()
    }
}
