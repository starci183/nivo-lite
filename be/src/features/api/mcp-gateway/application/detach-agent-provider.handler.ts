import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DetachAgentProviderCommand } from "./detach-agent-provider.command"

@CommandHandler(DetachAgentProviderCommand)
/** Detaches an agent from a provider. The admin service checks the owner or manager role. */
export class DetachAgentProviderHandler extends ICQRSHandler<DetachAgentProviderCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: DetachAgentProviderCommand): Promise<void> {
        return this.admin.detachProvider(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.agentId,
            command.params.request.connectionId,
        )
    }
}
