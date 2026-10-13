import { QueryHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GoogleStateQuery } from "./google-state.query"
import type { GoogleStateResult } from "./google-state.contracts"

@QueryHandler(GoogleStateQuery)
/** Says whether Google is set up on this deployment. */
export class GoogleStateHandler extends ICQRSHandler<GoogleStateQuery, GoogleStateResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly googleConnectionsService: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: GoogleStateQuery): Promise<GoogleStateResult> {
        const { request } = query.params
        return this.googleConnectionsService.state({
            principalId: query.params.principal.id,
            workspaceId: request.workspaceId,
        })
    }
}
