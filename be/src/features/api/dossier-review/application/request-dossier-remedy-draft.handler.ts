import { CommandHandler } from "@nestjs/cqrs"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import type { RemedyDraftRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestDossierRemedyDraftCommand } from "./request-dossier-remedy-draft.command"

@CommandHandler(RequestDossierRemedyDraftCommand)
/** Asks NIVO to draft the document that completes a finding. */
export class RequestDossierRemedyDraftHandler extends ICQRSHandler<
    RequestDossierRemedyDraftCommand,
    RemedyDraftRecord
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestDossierRemedyDraftCommand): Promise<RemedyDraftRecord> {
        return this.drafts.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.findingId,
            command.params.request.instructions,
        )
    }
}
