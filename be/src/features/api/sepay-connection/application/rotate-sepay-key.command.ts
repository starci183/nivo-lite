import { Command } from "@nestjs/cqrs"
import type { RotateSepayKeyResult, RotateSepayKeyRequest } from "./rotate-sepay-key.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Issues a new SePay API key. */
export class RotateSepayKeyCommand extends Command<RotateSepayKeyResult> {
    constructor(readonly params: ExecuteParams<RotateSepayKeyRequest>) {
        super()
    }
}
