import { CommandHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService, type SandboxNextCase } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetSandboxNextCaseCommand } from "./provider-sandbox.commands"

@CommandHandler(SetSandboxNextCaseCommand)
/** Picks the account's next case of that case's own operation. */
export class SetSandboxNextCaseHandler extends ICQRSHandler<SetSandboxNextCaseCommand, SandboxNextCase> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(command: SetSandboxNextCaseCommand): Promise<SandboxNextCase> {
        return this.accounts.setNextCase({ principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId }, command.params.request.connectionId, command.params.request.caseId)
    }
}
