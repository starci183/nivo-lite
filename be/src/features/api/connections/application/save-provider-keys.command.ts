import { Command } from "@nestjs/cqrs"
import type { ProviderKeysResult } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveProviderKeysRequest } from "./save-provider-keys.contracts"

/** Stores the keys the owner copied from payOS or Casso. */
export class SaveProviderKeysCommand extends Command<ProviderKeysResult> {
    constructor(readonly params: ExecuteParams<SaveProviderKeysRequest>) {
        super()
    }
}
