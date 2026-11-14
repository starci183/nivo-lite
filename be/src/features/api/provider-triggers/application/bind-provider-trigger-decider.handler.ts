import { CommandHandler } from "@nestjs/cqrs"
import { ProviderTriggerStatesService, type ProviderTriggerState } from "@modules/domain/provider-triggers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { BindProviderTriggerDeciderCommand } from "./bind-provider-trigger-decider.command"

@CommandHandler(BindProviderTriggerDeciderCommand)
/** Binds or unbinds the decider of an account's trigger. The capability checks the owner or manager role and writes the audit line. */
export class BindProviderTriggerDeciderHandler extends ICQRSHandler<BindProviderTriggerDeciderCommand, ProviderTriggerState> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly states: ProviderTriggerStatesService,
    ) {
        super(logger)
    }

    protected override process(command: BindProviderTriggerDeciderCommand): Promise<ProviderTriggerState> {
        return this.states.bindDecider(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.change,
        )
    }
}
