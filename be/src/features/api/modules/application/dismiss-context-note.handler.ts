import { CommandHandler } from "@nestjs/cqrs"
import { ContextNotesService } from "@modules/domain/module-context-notes"
import type { DismissedNote } from "@modules/domain/module-context-notes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DismissContextNoteCommand } from "./dismiss-context-note.command"

@CommandHandler(DismissContextNoteCommand)
/** Dismisses the note through the context-notes service. */
export class DismissContextNoteHandler extends ICQRSHandler<DismissContextNoteCommand, DismissedNote> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly notes: ContextNotesService,
    ) {
        super(logger)
    }

    protected override process(command: DismissContextNoteCommand): Promise<DismissedNote> {
        return this.notes.dismiss(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.noteId,
        )
    }
}
