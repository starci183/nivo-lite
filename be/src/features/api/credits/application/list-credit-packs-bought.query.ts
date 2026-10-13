import { Query } from "@nestjs/cqrs"
import type { CreditPackPurchase } from "@modules/domain/credits"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListCreditPacksBoughtRequest } from "./list-credit-packs-bought.contracts"

/** Asks for the add-on packs a workspace paid for this month. */
export class ListCreditPacksBoughtQuery extends Query<ReadonlyArray<CreditPackPurchase>> {
    constructor(readonly params: ExecuteParams<ListCreditPacksBoughtRequest>) {
        super()
    }
}
