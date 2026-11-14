import { CommandHandler } from "@nestjs/cqrs"
import { ApiKeysService, type ApiKeyView } from "@modules/domain/api-keys"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RenameApiKeyCommand } from "./rename-api-key.command"

@CommandHandler(RenameApiKeyCommand)
/** Renames a workspace API key through one domain-service call that checks the caller holds the key or manages the workspace. */
export class RenameApiKeyHandler extends ICQRSHandler<RenameApiKeyCommand, ApiKeyView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly apiKeys: ApiKeysService,
    ) {
        super(logger)
    }

    protected override process(command: RenameApiKeyCommand): Promise<ApiKeyView> {
        return this.apiKeys.renameKey(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.keyId,
            command.params.request.name,
        )
    }
}
