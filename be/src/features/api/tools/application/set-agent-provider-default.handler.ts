import { CommandHandler } from "@nestjs/cqrs"
import { ToolsConsoleService } from "@modules/domain/tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetAgentProviderDefaultCommand } from "./set-agent-provider-default.command"

@CommandHandler(SetAgentProviderDefaultCommand)
/** Sets an agent's default account of a provider. The admin service checks the owner or manager role. */
export class SetAgentProviderDefaultHandler extends ICQRSHandler<SetAgentProviderDefaultCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: ToolsConsoleService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentProviderDefaultCommand): Promise<void> {
        return this.admin.setProviderDefault(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.agentId,
            command.params.request.connectionId,
        )
    }
}
