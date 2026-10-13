import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChooseMetaPageCommand } from "./choose-meta-page.command"
import type { ChooseMetaPageResult } from "./choose-meta-page.contracts"

@CommandHandler(ChooseMetaPageCommand)
/** Chooses the Page of a Meta connection. */
export class ChooseMetaPageHandler extends ICQRSHandler<ChooseMetaPageCommand, ChooseMetaPageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly metaConnectionsService: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: ChooseMetaPageCommand): Promise<ChooseMetaPageResult> {
        const { request } = command.params
        return this.metaConnectionsService.choosePage(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.pageId,
        )
    }
}
