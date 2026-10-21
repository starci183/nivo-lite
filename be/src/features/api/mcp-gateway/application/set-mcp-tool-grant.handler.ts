import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetMcpToolGrantCommand } from "./set-mcp-tool-grant.command"

@CommandHandler(SetMcpToolGrantCommand)
/** Sets one agent's grant of a gateway tool. The admin service checks the owner or manager role. */
export class SetMcpToolGrantHandler extends ICQRSHandler<SetMcpToolGrantCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetMcpToolGrantCommand): Promise<void> {
        return this.admin.setGrant(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.grant,
        )
    }
}
