import { QueryHandler } from "@nestjs/cqrs"
import { PromoService } from "@modules/domain/promo"
import type { LeadWait } from "@modules/domain/promo"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadWaitQuery } from "./lead-wait.query"

@QueryHandler(LeadWaitQuery)
/** Reads leadWait through the workspace-authorized promo service. */
export class LeadWaitHandler extends ICQRSHandler<LeadWaitQuery, LeadWait> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promo: PromoService,
    ) {
        super(logger)
    }

    protected override process(query: LeadWaitQuery): Promise<LeadWait> {
        return this.promo.leadWait(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.leadId,
        )
    }
}
