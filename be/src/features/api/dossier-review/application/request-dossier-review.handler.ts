import { CommandHandler } from "@nestjs/cqrs"
import { DossierReviewRunsService } from "@modules/domain/dossier-review"
import type { ReviewRunRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestDossierReviewCommand } from "./request-dossier-review.command"

@CommandHandler(RequestDossierReviewCommand)
/** Asks for the review of one dossier, or of the whole set. */
export class RequestDossierReviewHandler extends ICQRSHandler<RequestDossierReviewCommand, ReviewRunRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly runs: DossierReviewRunsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestDossierReviewCommand): Promise<ReviewRunRecord> {
        return this.runs.request(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.dossierId,
        )
    }
}
