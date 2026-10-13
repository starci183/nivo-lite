import { CommandHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AutomationCard } from "@modules/domain/automations"
import { UpdatePipelineCommand } from "./update-pipeline.command"

@CommandHandler(UpdatePipelineCommand)
/** Changes one pipeline: switch, settings, wording, hide, send by itself. */
export class UpdatePipelineHandler extends ICQRSHandler<UpdatePipelineCommand, AutomationCard> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: UpdatePipelineCommand): Promise<AutomationCard> {
        return this.automations.update(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.templateKey,
            message.params.request.patch,
        )
    }
}
