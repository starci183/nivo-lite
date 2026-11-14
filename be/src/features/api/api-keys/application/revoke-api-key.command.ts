import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApiKeyView } from "@modules/domain/api-keys"
import type { RevokeApiKeyRequest } from "./revoke-api-key.contracts"

/** Asks to revoke an API key of a workspace the authenticated caller manages. */
export class RevokeApiKeyCommand extends Command<ApiKeyView> {
    constructor(readonly params: ExecuteParams<RevokeApiKeyRequest>) {
        super()
    }
}
