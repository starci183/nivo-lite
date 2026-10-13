import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MetaAuthorization } from "@modules/domain/meta-connections"
import { AuthorizeMetaCommand } from "./authorize-meta.command"

@CommandHandler(AuthorizeMetaCommand)
/** Starts the Meta login for a new or an existing connection through the MetaConnectionsService. */
export class AuthorizeMetaHandler extends ICQRSHandler<AuthorizeMetaCommand, MetaAuthorization> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly meta: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: AuthorizeMetaCommand): Promise<MetaAuthorization> {
        return this.meta.authorize(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
