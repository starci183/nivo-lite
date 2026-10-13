import { CommandHandler } from "@nestjs/cqrs"
import { HiringCandidatesService } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveHiringNotesCommand } from "./save-hiring-notes.command"

@CommandHandler(SaveHiringNotesCommand)
/** Save the notes about a candidate. */
export class SaveHiringNotesHandler extends ICQRSHandler<SaveHiringNotesCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly candidates: HiringCandidatesService,
    ) {
        super(logger)
    }

    protected override process(command: SaveHiringNotesCommand): Promise<void> {
        return this.candidates.saveNotes(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
