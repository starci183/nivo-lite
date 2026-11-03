import { QueryHandler } from "@nestjs/cqrs"
import { TemplateUpdatesService } from "@modules/domain/template-marketplace"
import type { UpdateOffer } from "@modules/domain/agent-templates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TemplateUpdateOffersQuery } from "./template-update-offers.query"

@QueryHandler(TemplateUpdateOffersQuery)
/** Lists the newer versions of templates offered to the agents of this workspace, branch by branch. */
export class TemplateUpdateOffersHandler extends ICQRSHandler<TemplateUpdateOffersQuery, ReadonlyArray<UpdateOffer>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateUpdatesService,
    ) {
        super(logger)
    }

    protected override process(query: TemplateUpdateOffersQuery): Promise<ReadonlyArray<UpdateOffer>> {
        const p = query.params.principal.id
        const r = query.params.request
        return this.svc.offers(p, r.workspaceId)
    }
}
