import { Command } from "@nestjs/cqrs"
import type { RevealSepayKeyResult, RevealSepayKeyRequest } from "./reveal-sepay-key.contracts"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Shows the SePay API key again. */
export class RevealSepayKeyCommand extends Command<RevealSepayKeyResult> {
    constructor(readonly params: ExecuteParams<RevealSepayKeyRequest>) {
        super()
    }
}
