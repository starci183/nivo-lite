import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveProviderKeysCommand } from "./save-provider-keys.command"
import type { SaveProviderKeysResult } from "./save-provider-keys.contracts"

@CommandHandler(SaveProviderKeysCommand)
/** Saves the keys copied from a payment provider. */
export class SaveProviderKeysHandler extends ICQRSHandler<SaveProviderKeysCommand, SaveProviderKeysResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveProviderKeysCommand): Promise<SaveProviderKeysResult> {
        const { request } = command.params
        return this.channelConnectionsService.saveProviderKeys(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.values,
        )
    }
}
