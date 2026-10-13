import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveHiringNotesRequest } from "./save-hiring-notes.contracts"

/** Asks for save the notes about a candidate. */
export class SaveHiringNotesCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SaveHiringNotesRequest>) {
        super()
    }
}
