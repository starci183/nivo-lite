import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { WizardConnection } from "@modules/domain/channel-connections"
import { UpdateMoneyConnectionCommand } from "./update-money-connection.command"

@CommandHandler(UpdateMoneyConnectionCommand)
/** Edits a bank or payment feed through the ChannelConnectionsService. */
export class UpdateMoneyConnectionHandler extends ICQRSHandler<UpdateMoneyConnectionCommand, WizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateMoneyConnectionCommand): Promise<WizardConnection> {
        return this.channels.updateMoneyConnection(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            {
                environment: command.params.request.environment,
                name: command.params.request.name,
                bankCode: command.params.request.bankCode,
                accountNumber: command.params.request.accountNumber,
                holder: command.params.request.holder,
                apiKey: command.params.request.apiKey,
            },
        )
    }
}
