import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveLocationRequest } from "./save-location.contracts"

/** Asks to create or rename one stock location. */
export class SaveLocationCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SaveLocationRequest>) {
        super()
    }
}
