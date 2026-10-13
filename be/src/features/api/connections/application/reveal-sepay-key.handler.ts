import { CommandHandler } from "@nestjs/cqrs"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RevealSepayKeyResult } from "./reveal-sepay-key.contracts"
import { RevealSepayKeyCommand } from "./reveal-sepay-key.command"

@CommandHandler(RevealSepayKeyCommand)
/** Shows the SePay API key again through the ChannelConnectionsService. */
export class RevealSepayKeyHandler extends ICQRSHandler<RevealSepayKeyCommand, RevealSepayKeyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly channels: ChannelConnectionsService,
    ) {
        super(logger)
    }

    protected override process(command: RevealSepayKeyCommand): Promise<RevealSepayKeyResult> {
        return this.channels.revealSepayKey(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
