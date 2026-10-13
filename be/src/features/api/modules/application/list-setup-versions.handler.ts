import { QueryHandler } from "@nestjs/cqrs"
import { SetupChatService } from "@modules/domain/modules"
import type { SetupVersions } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListSetupVersionsQuery } from "./list-setup-versions.query"

@QueryHandler(ListSetupVersionsQuery)
/** Answers the versions from the setup chat service. */
export class ListSetupVersionsHandler extends ICQRSHandler<ListSetupVersionsQuery, SetupVersions> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: SetupChatService,
    ) {
        super(logger)
    }

    protected override process(query: ListSetupVersionsQuery): Promise<SetupVersions> {
        return this.chat.versionsOf(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
