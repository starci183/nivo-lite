import { CommandHandler } from "@nestjs/cqrs"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveDossierRemedyDraftCommand } from "./save-dossier-remedy-draft.command"

@CommandHandler(SaveDossierRemedyDraftCommand)
/** Saves the owner's edits of a proposed draft. */
export class SaveDossierRemedyDraftHandler extends ICQRSHandler<SaveDossierRemedyDraftCommand, RemedyDraftRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveDossierRemedyDraftCommand): Promise<RemedyDraftRecord> {
        return this.drafts.save(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.draftId,
            command.params.request.title,
            command.params.request.body,
        )
    }
}
