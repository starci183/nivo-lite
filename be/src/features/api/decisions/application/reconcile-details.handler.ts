import { QueryHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { ReconcileDetails } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReconcileDetailsQuery } from "./reconcile-details.query"

@QueryHandler(ReconcileDetailsQuery)
/** Answers the payment and the candidate invoices from the decisions service. */
export class ReconcileDetailsHandler extends ICQRSHandler<ReconcileDetailsQuery, ReconcileDetails> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(query: ReconcileDetailsQuery): Promise<ReconcileDetails> {
        return this.decisions.reconcileDetails(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.workItemId,
        )
    }
}
