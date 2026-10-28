import { CommandHandler } from "@nestjs/cqrs"
import { ZaloPageService } from "@modules/domain/channels"
import type { ZaloPageView } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RecheckZaloConnectionCommand } from "./recheck-zalo-connection.command"

@CommandHandler(RecheckZaloConnectionCommand)
/** Answers the check of a Zalo OA connection, run again through the ZaloPageService. */
export class RecheckZaloConnectionHandler extends ICQRSHandler<RecheckZaloConnectionCommand, ZaloPageView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ZaloPageService,
    ) {
        super(logger)
    }

    protected override process(query: RecheckZaloConnectionCommand): Promise<ZaloPageView> {
        return this.page.recheck(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
