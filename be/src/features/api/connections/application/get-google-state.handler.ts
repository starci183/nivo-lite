import { QueryHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GoogleStateResult } from "./get-google-state.contracts"
import { GetGoogleStateQuery } from "./get-google-state.query"

@QueryHandler(GetGoogleStateQuery)
/** Asks whether Google can be used on this deployment through the GoogleConnectionsService. */
export class GetGoogleStateHandler extends ICQRSHandler<GetGoogleStateQuery, GoogleStateResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly google: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: GetGoogleStateQuery): Promise<GoogleStateResult> {
        return this.google.state({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
