import { QueryHandler } from "@nestjs/cqrs"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import { type OptionalRemedyDraft, DossierRemedyDraftQuery } from "./dossier-remedy-draft.query"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"

@QueryHandler(DossierRemedyDraftQuery)
/** Reads one remedy draft, or nothing when it does not exist in the workspace. */
export class DossierRemedyDraftHandler extends ICQRSHandler<DossierRemedyDraftQuery, OptionalRemedyDraft> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super(logger)
    }

    protected override process(query: DossierRemedyDraftQuery): Promise<OptionalRemedyDraft> {
        return this.drafts.get(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.draftId,
        )
    }
}
