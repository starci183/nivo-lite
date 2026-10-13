import { QueryHandler } from "@nestjs/cqrs"
import { PromoService } from "@modules/domain/promo"
import type { PromoState } from "@modules/domain/promo"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PromoStateQuery } from "./promo-state.query"

@QueryHandler(PromoStateQuery)
/** Reads promoState through the workspace-authorized promo service. */
export class PromoStateHandler extends ICQRSHandler<PromoStateQuery, PromoState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promo: PromoService,
    ) {
        super(logger)
    }

    protected override process(query: PromoStateQuery): Promise<PromoState> {
        return this.promo.state(query.params.principal.id, query.params.request.workspaceId)
    }
}
