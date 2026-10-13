import { QueryHandler } from "@nestjs/cqrs"
import { LeadBoardService } from "@modules/domain/lead-views"
import type { LeadBoardItem } from "@modules/domain/lead-views"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadBoardQuery } from "./lead-board.query"

@QueryHandler(LeadBoardQuery)
/** Delegates the authorized lead board to its owning service. */
export class LeadBoardHandler extends ICQRSHandler<LeadBoardQuery, Array<LeadBoardItem>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: LeadBoardService,
    ) {
        super(logger)
    }

    protected override process(query: LeadBoardQuery): Promise<Array<LeadBoardItem>> {
        return this.leads.read(query.params.principal.id, query.params.request.workspaceId)
    }
}
