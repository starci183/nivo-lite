import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StartMoneyCommand } from "./start-money.command"
import type { StartMoneyResult } from "./start-money.contracts"

@CommandHandler(StartMoneyCommand)
/** Starts a bank or payment feed connection. */
export class StartMoneyHandler extends ICQRSHandler<StartMoneyCommand, StartMoneyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: StartMoneyCommand): Promise<StartMoneyResult> {
        const { request } = command.params
        return this.channelConnectionsService.startMoneyConnection(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            {
                provider: request.provider,
                environment: request.environment,
                name: request.name,
                bankCode: request.bankCode,
                accountNumber: request.accountNumber,
                holder: request.holder,
            },
        )
    }
}
