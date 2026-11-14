import { Injectable } from "@nestjs/common"
import { DossierReviewRunsService } from "@modules/domain/dossier-review"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"

@Injectable()
/** Asks the shop-document critic to read a document; a failure is logged and never fails the facts job that asked. */
export class DocumentReviewService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly reviews: DossierReviewRunsService,
    ) {}

    /**
     * A document was read or given up on: its critique waits for a run, in the background (no truth waits for it). `{ resume: true }`
     * goes on with a critique that stopped: its count of runs without progress is kept (`DossierReviewRunsService.requestForSource`).
     * The truths tick no longer asks for it (no reading waits for a critique).
     */
    async requestForSource(workspaceId: string, sourceId: string, how: { readonly resume?: boolean } = {}): Promise<void> {
        try {
            await this.reviews.requestForSource(workspaceId, sourceId, how)
        } catch (cause) {
            this.logger.error(BrainLogEvent.ReviewRequestFailed, cause, { sourceId })
        }
    }

    /** A document was deleted: its critique and its open points go with it. */
    async requestForGoneSource(workspaceId: string, sourceId: string): Promise<void> {
        try {
            await this.reviews.requestForGoneSource(workspaceId, sourceId)
        } catch (cause) {
            this.logger.error(BrainLogEvent.ReviewRequestFailed, cause, { sourceId })
        }
    }
}
