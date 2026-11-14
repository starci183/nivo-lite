import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApiKeyView } from "@modules/domain/api-keys"
import type { RenameApiKeyRequest } from "./rename-api-key.contracts"

/** Asks to rename an API key of a workspace (owner or manager only). */
export class RenameApiKeyCommand extends Command<ApiKeyView> {
    constructor(readonly params: ExecuteParams<RenameApiKeyRequest>) {
        super()
    }
}
