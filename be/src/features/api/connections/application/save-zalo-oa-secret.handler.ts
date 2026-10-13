import { CommandHandler } from "@nestjs/cqrs"
import { ZaloConnectService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import { SaveZaloOaSecretCommand } from "./save-zalo-oa-secret.command"

@CommandHandler(SaveZaloOaSecretCommand)
/** Seals the OA Secret Key of a Zalo connection through the ZaloConnectService. */
export class SaveZaloOaSecretHandler extends ICQRSHandler<SaveZaloOaSecretCommand, ZaloWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
    ) {
        super(logger)
    }

    protected override process(command: SaveZaloOaSecretCommand): Promise<ZaloWizardConnection> {
        return this.zalo.saveOaSecret(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.oaSecret,
        )
    }
}
