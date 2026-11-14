import { CommandHandler } from "@nestjs/cqrs"
import { ToolsConsoleService } from "@modules/domain/tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AttachAgentProviderCommand } from "./attach-agent-provider.command"

@CommandHandler(AttachAgentProviderCommand)
/** Attaches an agent to a connected provider to a connected account. The admin service checks the owner or manager role. */
export class AttachAgentProviderHandler extends ICQRSHandler<AttachAgentProviderCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: ToolsConsoleService,
    ) {
        super(logger)
    }

    protected override process(command: AttachAgentProviderCommand): Promise<void> {
        return this.admin.attachProvider(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.agentId,
            command.params.request.wish,
        )
    }
}
