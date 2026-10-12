import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveZaloOaSecretCommand } from "./save-zalo-oa-secret.command"
import type { SaveZaloOaSecretResult } from "./save-zalo-oa-secret.contracts"

@CommandHandler(SaveZaloOaSecretCommand)
/** Saves the OA secret key of the Zalo webhook screen. */
export class SaveZaloOaSecretHandler extends ICQRSHandler<SaveZaloOaSecretCommand, SaveZaloOaSecretResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channelConnectionsService: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveZaloOaSecretCommand): Promise<SaveZaloOaSecretResult> {
        const { request } = command.params
        return this.channelConnectionsService.saveZaloOaSecret(
            { principalId: command.params.principal.id, workspaceId: request.workspaceId },
            request.connectionId,
            request.oaSecret,
        )
    }
}
