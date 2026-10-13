import { CommandHandler } from "@nestjs/cqrs"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MetaWizardConnection } from "@modules/domain/meta-connections"
import { ChooseMetaPageCommand } from "./choose-meta-page.command"

@CommandHandler(ChooseMetaPageCommand)
/** Chooses the Page of a Meta connection through the MetaConnectionsService. */
export class ChooseMetaPageHandler extends ICQRSHandler<ChooseMetaPageCommand, MetaWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly meta: MetaConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: ChooseMetaPageCommand): Promise<MetaWizardConnection> {
        return this.meta.choosePage(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.pageId,
        )
    }
}
