import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveProviderKeysRequest, SaveProviderKeysResult } from "./save-provider-keys.contracts"

/** Saves the keys copied from a payment provider. */
export class SaveProviderKeysCommand extends Command<SaveProviderKeysResult> {
    constructor(readonly params: ExecuteParams<SaveProviderKeysRequest>) {
        super()
    }
}
