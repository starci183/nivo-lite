import { QueryHandler } from "@nestjs/cqrs"
import { ZaloConnectService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import { GetZaloConnectionQuery } from "./get-zalo-connection.query"

@QueryHandler(GetZaloConnectionQuery)
/** Asks for the wizard view of a Zalo OA connection through the ZaloConnectService. */
export class GetZaloConnectionHandler extends ICQRSHandler<GetZaloConnectionQuery, ZaloWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
    ) {
        super(logger)
    }

    protected override process(query: GetZaloConnectionQuery): Promise<ZaloWizardConnection> {
        return this.zalo.view(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
