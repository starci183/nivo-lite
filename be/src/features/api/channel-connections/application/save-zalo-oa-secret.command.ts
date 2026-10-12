import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveZaloOaSecretRequest, SaveZaloOaSecretResult } from "./save-zalo-oa-secret.contracts"

/** Saves the OA secret key of the Zalo webhook screen. */
export class SaveZaloOaSecretCommand extends Command<SaveZaloOaSecretResult> {
    constructor(readonly params: ExecuteParams<SaveZaloOaSecretRequest>) {
        super()
    }
}
