import { CommandHandler } from "@nestjs/cqrs"
import { ApiKeysService } from "@modules/domain/api-keys"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RevokeApiKeyResult } from "./revoke-api-key.contracts"
import { RevokeApiKeyCommand } from "./revoke-api-key.command"

@CommandHandler(RevokeApiKeyCommand)
/** Revokes a workspace API key through one domain-service call that checks the caller manages the workspace. */
export class RevokeApiKeyHandler extends ICQRSHandler<RevokeApiKeyCommand, RevokeApiKeyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly apiKeys: ApiKeysService,
    ) {
        super(logger)
    }

    protected override process(command: RevokeApiKeyCommand): Promise<RevokeApiKeyResult> {
        return this.apiKeys.revokeKey(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.keyId,
        )
    }
}
