import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MetaCheck } from "@modules/domain/meta-connections"
import { CheckMetaCommand } from "./check-meta.command"

@CommandHandler(CheckMetaCommand)
/** Asks Meta what it knows about a connection, optionally repairing the subscriptions through the MetaConnectionsService. */
export class CheckMetaHandler extends ICQRSHandler<CheckMetaCommand, MetaCheck> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly meta: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: CheckMetaCommand): Promise<MetaCheck> {
        return this.meta.check(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.repair,
        )
    }
}
