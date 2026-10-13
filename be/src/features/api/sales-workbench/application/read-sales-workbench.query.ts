import { Query } from "@nestjs/cqrs"
import type { SalesWorkbenchData } from "@modules/domain/sales-workbench"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadSalesWorkbenchRequest } from "./read-sales-workbench.contracts"

/** Asks for the selected workspace's complete Sales workbench. */
export class ReadSalesWorkbenchQuery extends Query<SalesWorkbenchData> {
    constructor(readonly params: ExecuteParams<ReadSalesWorkbenchRequest>) {
        super()
    }
}
