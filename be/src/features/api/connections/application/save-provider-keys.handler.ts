import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ProviderKeysResult } from "@modules/domain/channel-connections"
import { SaveProviderKeysCommand } from "./save-provider-keys.command"

@CommandHandler(SaveProviderKeysCommand)
/** Stores the keys the owner copied from payOS or Casso through the ChannelConnectionsService. */
export class SaveProviderKeysHandler extends ICQRSHandler<SaveProviderKeysCommand, ProviderKeysResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveProviderKeysCommand): Promise<ProviderKeysResult> {
        return this.channels.saveProviderKeys(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.values,
        )
    }
}
