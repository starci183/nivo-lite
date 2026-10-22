import { Query } from "@nestjs/cqrs"
import type { ChainView } from "@modules/domain/work-chains"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadWorkChainRequest } from "./read-work-chain.contracts"

/** Asks for the chain of one thread: its steps and its summary. */
export class ReadWorkChainQuery extends Query<ChainView> {
    constructor(readonly params: ExecuteParams<ReadWorkChainRequest>) {
        super()
    }
}
