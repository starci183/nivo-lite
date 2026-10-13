import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { WizardConnection } from "@modules/domain/channel-connections"
import { StartMoneyConnectionCommand } from "./start-money-connection.command"

@CommandHandler(StartMoneyConnectionCommand)
/** Starts a bank or payment feed as pending through the ChannelConnectionsService. */
export class StartMoneyConnectionHandler extends ICQRSHandler<StartMoneyConnectionCommand, WizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: StartMoneyConnectionCommand): Promise<WizardConnection> {
        return this.channels.startMoneyConnection(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            {
                provider: command.params.request.provider,
                environment: command.params.request.environment,
                name: command.params.request.name,
                bankCode: command.params.request.bankCode,
                accountNumber: command.params.request.accountNumber,
                holder: command.params.request.holder,
            },
        )
    }
}
