import { Query } from "@nestjs/cqrs"
import type { CreditTopupLot } from "@modules/domain/credits"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListCreditTopupLotsRequest } from "./list-credit-topup-lots.contracts"

/** Asks for list credit topup lots. */
export class ListCreditTopupLotsQuery extends Query<ReadonlyArray<CreditTopupLot>> {
    constructor(readonly params: ExecuteParams<ListCreditTopupLotsRequest>) {
        super()
    }
}
