import { CommandHandler } from "@nestjs/cqrs"
import { ProviderTriggerStatesService, type ProviderTriggerState } from "@modules/domain/provider-triggers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetProviderTriggerEnabledCommand } from "./set-provider-trigger-enabled.command"

@CommandHandler(SetProviderTriggerEnabledCommand)
/** Turns the trigger of an account on or off. The capability checks the owner or manager role and writes the audit line. */
export class SetProviderTriggerEnabledHandler extends ICQRSHandler<SetProviderTriggerEnabledCommand, ProviderTriggerState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly states: ProviderTriggerStatesService,
    ) {
        super(logger)
    }

    protected override process(command: SetProviderTriggerEnabledCommand): Promise<ProviderTriggerState> {
        return this.states.setEnabled(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.change,
        )
    }
}
