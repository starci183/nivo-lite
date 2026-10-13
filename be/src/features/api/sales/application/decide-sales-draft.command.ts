import type { SalesAction, SalesDraftRequest } from "@modules/domain/sales"
import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Queues a person's decision on a Sales draft. */
export class DecideSalesDraftCommand extends Command<SalesAction> {
    constructor(readonly params: ExecuteParams<SalesDraftRequest>) {
        super()
    }
}
