import { Query } from "@nestjs/cqrs"
import type { CreditPack } from "@modules/domain/credits"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListCreditPacksRequest } from "./list-credit-packs.contracts"

/** Asks for list credit packs. */
export class ListCreditPacksQuery extends Query<ReadonlyArray<CreditPack>> {
    constructor(readonly params: ExecuteParams<ListCreditPacksRequest>) {
        super()
    }
}
