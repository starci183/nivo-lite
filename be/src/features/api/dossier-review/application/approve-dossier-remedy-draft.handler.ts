import { CommandHandler } from "@nestjs/cqrs"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApproveDossierRemedyDraftCommand } from "./approve-dossier-remedy-draft.command"

@CommandHandler(ApproveDossierRemedyDraftCommand)
/** Approves a proposed draft: it becomes a document of the dossier and the finding is resolved. */
export class ApproveDossierRemedyDraftHandler extends ICQRSHandler<
    ApproveDossierRemedyDraftCommand,
    RemedyDraftRecord
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super(logger)
    }

    protected override process(command: ApproveDossierRemedyDraftCommand): Promise<RemedyDraftRecord> {
        return this.drafts.approve(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.draftId,
        )
    }
}
