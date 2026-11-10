import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetDefaultReceivingAccountCommand } from "./set-default-receiving-account.command"

@CommandHandler(SetDefaultReceivingAccountCommand)
/** Names the payment account the shop receives money on by default. The admin service checks the owner role. */
export class SetDefaultReceivingAccountHandler extends ICQRSHandler<SetDefaultReceivingAccountCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetDefaultReceivingAccountCommand): Promise<void> {
        return this.admin.setDefaultReceivingAccount(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
