import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateMoneyCommand } from "./update-money.command"
import type { UpdateMoneyResult } from "./update-money.contracts"

@CommandHandler(UpdateMoneyCommand)
/** Edits a bank or payment feed connection. */
export class UpdateMoneyHandler extends ICQRSHandler<UpdateMoneyCommand, UpdateMoneyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateMoneyCommand): Promise<UpdateMoneyResult> {
        const { request } = command.params
        return this.channelConnectionsService.updateMoneyConnection(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            {
                environment: request.environment,
                name: request.name,
                bankCode: request.bankCode,
                accountNumber: request.accountNumber,
                holder: request.holder,
                apiKey: request.apiKey,
            },
        )
    }
}
