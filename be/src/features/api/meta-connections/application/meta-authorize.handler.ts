import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaAuthorizeCommand } from "./meta-authorize.command"
import type { MetaAuthorizeResult } from "./meta-authorize.contracts"

@CommandHandler(MetaAuthorizeCommand)
/** Starts the Meta login. */
export class MetaAuthorizeHandler extends ICQRSHandler<MetaAuthorizeCommand, MetaAuthorizeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: MetaAuthorizeCommand): Promise<MetaAuthorizeResult> {
        const { request } = command.params
        return this.metaConnectionsService.authorize(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
        )
    }
}
