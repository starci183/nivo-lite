import { Command } from "@nestjs/cqrs"
import type { DismissedNote } from "@modules/domain/module-context-notes"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DismissContextNoteRequest } from "./dismiss-context-note.contracts"

/** Asks to dismiss a pending context note. */
export class DismissContextNoteCommand extends Command<DismissedNote> {
    constructor(readonly params: ExecuteParams<DismissContextNoteRequest>) {
        super()
    }
}
