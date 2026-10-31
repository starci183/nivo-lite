import { Injectable } from "@nestjs/common"
import { DossierReviewRunsService } from "@modules/domain/dossier-review"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"

@Injectable()
/** Asks the dossier review to look at the dossier a document touches; a failure is logged and never fails the facts job that asked. */
export class DocumentReviewService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly reviews: DossierReviewRunsService,
    ) {}

    /** A document was read or given up on: its dossier is reviewed again. */
    async requestForSource(workspaceId: string, sourceId: string): Promise<void> {
        try {
            await this.reviews.requestForSource(workspaceId, sourceId)
        } catch (cause) {
            this.logger.error(BrainLogEvent.ReviewRequestFailed, cause, { sourceId })
        }
    }

    /** A document was deleted: the dossiers that cited it are reviewed again; its topic is gone, so only its title names the dossier. */
    async requestForGoneSource(workspaceId: string, sourceId: string, title: string): Promise<void> {
        try {
            await this.reviews.requestForGoneSource(workspaceId, sourceId, null, title)
        } catch (cause) {
            this.logger.error(BrainLogEvent.ReviewRequestFailed, cause, { sourceId })
        }
    }
}
