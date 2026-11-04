import { CommandHandler } from "@nestjs/cqrs"
import { TemplateUpdatesService } from "@modules/domain/template-marketplace"
import type { UpdateOffer } from "@nivo-lite/agent-sdk/template"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AcceptTemplateUpdateCommand } from "./accept-template-update.command"

@CommandHandler(AcceptTemplateUpdateCommand)
/** Takes the named branches of a newer version into the agent, keeping every edit of the buyer on the others. */
export class AcceptTemplateUpdateHandler extends ICQRSHandler<AcceptTemplateUpdateCommand, UpdateOffer | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateUpdatesService,
    ) {
        super(logger)
    }

    protected override process(command: AcceptTemplateUpdateCommand): Promise<UpdateOffer | null> {
        return this.svc.accept(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.installationId,
            command.params.request.unitIds,
        )
    }
}
