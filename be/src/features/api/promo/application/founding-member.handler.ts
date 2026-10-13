import { QueryHandler } from "@nestjs/cqrs"
import { PromoService } from "@modules/domain/promo"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { FoundingMemberQuery } from "./founding-member.query"

@QueryHandler(FoundingMemberQuery)
/** Reads foundingMember through the workspace-authorized promo service. */
export class FoundingMemberHandler extends ICQRSHandler<FoundingMemberQuery, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promo: PromoService,
    ) {
        super(logger)
    }

    protected override process(query: FoundingMemberQuery): Promise<boolean> {
        return this.promo.foundingMember(query.params.principal.id, query.params.request.workspaceId)
    }
}
