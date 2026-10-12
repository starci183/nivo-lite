import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevealSepayKeyRequest, RevealSepayKeyResult } from "./reveal-sepay-key.contracts"

/** Shows the SePay API key again. */
export class RevealSepayKeyQuery extends Query<RevealSepayKeyResult> {
    constructor(readonly params: ExecuteParams<RevealSepayKeyRequest>) {
        super()
    }
}
