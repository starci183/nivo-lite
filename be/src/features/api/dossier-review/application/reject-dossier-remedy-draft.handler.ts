import { CommandHandler } from "@nestjs/cqrs"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RejectDossierRemedyDraftCommand } from "./reject-dossier-remedy-draft.command"

@CommandHandler(RejectDossierRemedyDraftCommand)
/** Rejects a proposed draft; the finding stays as it was. */
export class RejectDossierRemedyDraftHandler extends ICQRSHandler<RejectDossierRemedyDraftCommand, RemedyDraftRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super(logger)
    }

    protected override process(command: RejectDossierRemedyDraftCommand): Promise<RemedyDraftRecord> {
        return this.drafts.reject(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.draftId,
            command.params.request.reason,
        )
    }
}
