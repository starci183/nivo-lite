import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveShiftsCoverageRequest } from "./save-shifts-coverage.contracts"

/** Asks for create or update one coverage block. */
export class SaveShiftsCoverageCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SaveShiftsCoverageRequest>) {
        super()
    }
}
