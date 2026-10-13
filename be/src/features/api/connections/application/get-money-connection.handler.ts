import { QueryHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { WizardConnection } from "@modules/domain/channel-connections"
import { GetMoneyConnectionQuery } from "./get-money-connection.query"

@QueryHandler(GetMoneyConnectionQuery)
/** Asks for the wizard view of a bank or payment feed through the ChannelConnectionsService. */
export class GetMoneyConnectionHandler extends ICQRSHandler<GetMoneyConnectionQuery, WizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: GetMoneyConnectionQuery): Promise<WizardConnection> {
        return this.channels.resumeConnection(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
