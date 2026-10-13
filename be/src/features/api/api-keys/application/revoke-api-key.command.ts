import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevokeApiKeyRequest, RevokeApiKeyResult } from "./revoke-api-key.contracts"

/** Asks to revoke an API key of a workspace the authenticated caller manages. */
export class RevokeApiKeyCommand extends Command<RevokeApiKeyResult> {
    constructor(readonly params: ExecuteParams<RevokeApiKeyRequest>) {
        super()
    }
}
