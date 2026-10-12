import { QueryHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RevealSepayKeyQuery } from "./reveal-sepay-key.query"
import type { RevealSepayKeyResult } from "./reveal-sepay-key.contracts"

@QueryHandler(RevealSepayKeyQuery)
/** Shows the SePay API key again. */
export class RevealSepayKeyHandler extends ICQRSHandler<RevealSepayKeyQuery, RevealSepayKeyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: RevealSepayKeyQuery): Promise<RevealSepayKeyResult> {
        const { request } = query.params
        return this.channelConnectionsService.revealSepayKey(
            { principalId: query.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
