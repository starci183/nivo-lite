import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetMcpConnectorCredentialCommand } from "./set-mcp-connector-credential.command"

@CommandHandler(SetMcpConnectorCredentialCommand)
/** Sets or rotates the sealed credential of a remote connector. The admin service checks the owner or manager role. */
export class SetMcpConnectorCredentialHandler extends ICQRSHandler<SetMcpConnectorCredentialCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetMcpConnectorCredentialCommand): Promise<number> {
        return this.admin.setCredential(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.credential,
        )
    }
}
