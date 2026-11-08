import { QueryHandler } from "@nestjs/cqrs"
import { SepayConnectionService, type SepayConnectionView } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetSepayConnectionQuery } from "./get-sepay-connection.query"

@QueryHandler(GetSepayConnectionQuery)
/** Asks for the page read model of one SePay connection through the SepayConnectionService. */
export class GetSepayConnectionHandler extends ICQRSHandler<GetSepayConnectionQuery, SepayConnectionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sepay: SepayConnectionService,
    ) {
        super(logger)
    }

    protected override process(query: GetSepayConnectionQuery): Promise<SepayConnectionView> {
        return this.sepay.read(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
