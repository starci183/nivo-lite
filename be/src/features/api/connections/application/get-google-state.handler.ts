import { QueryHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService, SheetsGrantService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GoogleStateResult } from "./get-google-state.contracts"
import { GetGoogleStateQuery } from "./get-google-state.query"

@QueryHandler(GetGoogleStateQuery)
/** Asks whether Google can be used on this deployment and where its ledger stands, through the GoogleConnectionsService and the SheetsGrantService. */
export class GetGoogleStateHandler extends ICQRSHandler<GetGoogleStateQuery, GoogleStateResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly google: GoogleConnectionsService,
        private readonly sheets: SheetsGrantService,
    ) {
        super(logger)
    }

    protected override async process(query: GetGoogleStateQuery): Promise<GoogleStateResult> {
        const actor = { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId }
        const [setup, ledger] = await Promise.all([this.google.state(actor), this.sheets.grant(actor)])
        return { ...setup, ledger }
    }
}
