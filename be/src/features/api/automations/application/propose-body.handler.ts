import { CommandHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { BodyProposal } from "@modules/domain/automations"
import { ProposeBodyCommand } from "./propose-body.command"

@CommandHandler(ProposeBodyCommand)
/** Proposes the shop's own wording of a template. */
export class ProposeBodyHandler extends ICQRSHandler<ProposeBodyCommand, BodyProposal> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: ProposeBodyCommand): Promise<BodyProposal> {
        return this.automations.proposeBody(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.templateKey,
        )
    }
}
