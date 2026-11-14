import { CommandHandler } from "@nestjs/cqrs"
import { CareOptOutService, type CareOptOutAnswer } from "@modules/domain/agent-doors"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetCareOptOutCommand } from "./set-care-opt-out.command"

@CommandHandler(SetCareOptOutCommand)
/** Sets or clears a customer's care opt-out, for an owner or a manager; who and when are recorded. */
export class SetCareOptOutHandler extends ICQRSHandler<SetCareOptOutCommand, CareOptOutAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly optOuts: CareOptOutService,
    ) {
        super(logger)
    }

    protected override process(command: SetCareOptOutCommand): Promise<CareOptOutAnswer> {
        return this.optOuts.set(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.leadId,
            command.params.request.optOut,
        )
    }
}
