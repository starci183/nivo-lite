import { CommandHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmitEventCommand } from "./emit-event.command"
import type { EmitEventResult } from "./emit-event.contracts"

@CommandHandler(EmitEventCommand)
/** Tells the engine a business event happened. */
export class EmitEventHandler extends ICQRSHandler<EmitEventCommand, EmitEventResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: EmitEventCommand): Promise<EmitEventResult> {
        return this.automations.emit(
            message.params.principal.id,
            message.params.request.workspaceId,
            message.params.request.event,
        )
    }
}
