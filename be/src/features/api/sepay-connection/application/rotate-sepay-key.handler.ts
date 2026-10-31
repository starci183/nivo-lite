import { CommandHandler } from "@nestjs/cqrs"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RotateSepayKeyResult } from "./rotate-sepay-key.contracts"
import { RotateSepayKeyCommand } from "./rotate-sepay-key.command"

@CommandHandler(RotateSepayKeyCommand)
/** Issues a new SePay API key through the SepayConnectionService. */
export class RotateSepayKeyHandler extends ICQRSHandler<RotateSepayKeyCommand, RotateSepayKeyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sepay: SepayConnectionService,
    ) {
        super(logger)
    }

    protected override process(command: RotateSepayKeyCommand): Promise<RotateSepayKeyResult> {
        return this.sepay.rotateKey(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
        )
    }
}
