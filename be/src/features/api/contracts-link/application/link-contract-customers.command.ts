import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LinkContractCustomersRequest, LinkContractCustomersResult } from "./link-contract-customers.contracts"

/** Asks to link the contracts of the workspace of the caller to their customers. */
export class LinkContractCustomersCommand extends Command<LinkContractCustomersResult> {
    constructor(readonly params: ExecuteParams<LinkContractCustomersRequest>) {
        super()
    }
}
