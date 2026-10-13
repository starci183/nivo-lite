import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateApiKeyRequest, CreateApiKeyResult } from "./create-api-key.contracts"

/** Asks to create an API key for a workspace the authenticated caller manages. */
export class CreateApiKeyCommand extends Command<CreateApiKeyResult> {
    constructor(readonly params: ExecuteParams<CreateApiKeyRequest>) {
        super()
    }
}
