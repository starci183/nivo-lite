import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckMetaCommand } from "./check-meta.command"
import type { CheckMetaResult } from "./check-meta.contracts"

@CommandHandler(CheckMetaCommand)
/** Asks Meta what it has for a connection. */
export class CheckMetaHandler extends ICQRSHandler<CheckMetaCommand, CheckMetaResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: CheckMetaCommand): Promise<CheckMetaResult> {
        const { request } = command.params
        return this.metaConnectionsService.check(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.repair === true,
        )
    }
}
