import { CommandHandler } from "@nestjs/cqrs"
import { ApiKeysService } from "@modules/domain/api-keys"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CreateApiKeyResult } from "./create-api-key.contracts"
import { CreateApiKeyCommand } from "./create-api-key.command"

@CommandHandler(CreateApiKeyCommand)
/** Creates a workspace API key through one domain-service call that checks the caller manages the workspace. */
export class CreateApiKeyHandler extends ICQRSHandler<CreateApiKeyCommand, CreateApiKeyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly apiKeys: ApiKeysService,
    ) {
        super(logger)
    }

    protected override process(command: CreateApiKeyCommand): Promise<CreateApiKeyResult> {
        return this.apiKeys.createKey(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.name,
        )
    }
}
