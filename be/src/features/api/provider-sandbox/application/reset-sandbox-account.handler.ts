import { CommandHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ResetSandboxAccountCommand } from "./provider-sandbox.commands"

@CommandHandler(ResetSandboxAccountCommand)
/** Forgets the account's state, next cases and call log. */
export class ResetSandboxAccountHandler extends ICQRSHandler<ResetSandboxAccountCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(command: ResetSandboxAccountCommand): Promise<void> {
        return this.accounts.reset({ principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId }, command.params.request.connectionId)
    }
}
