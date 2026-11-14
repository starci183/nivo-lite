import { CommandHandler } from "@nestjs/cqrs"
import { ApiKeysService, type ApiKeyView } from "@modules/domain/api-keys"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RevokeApiKeyCommand } from "./revoke-api-key.command"

@CommandHandler(RevokeApiKeyCommand)
/** Revokes a workspace API key through one domain-service call that checks the caller manages the workspace. */
export class RevokeApiKeyHandler extends ICQRSHandler<RevokeApiKeyCommand, ApiKeyView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly apiKeys: ApiKeysService,
    ) {
        super(logger)
    }

    protected override process(command: RevokeApiKeyCommand): Promise<ApiKeyView> {
        return this.apiKeys.revokeKey(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.keyId,
        )
    }
}
