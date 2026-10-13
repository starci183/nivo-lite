import { QueryHandler } from "@nestjs/cqrs"
import { SalesWorkbenchService } from "@modules/domain/sales-workbench"
import type { SalesWorkbenchData } from "@modules/domain/sales-workbench"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadSalesWorkbenchQuery } from "./read-sales-workbench.query"

@QueryHandler(ReadSalesWorkbenchQuery)
/** Answers the Sales workbench through its workspace-authorized capability. */
export class ReadSalesWorkbenchHandler extends ICQRSHandler<ReadSalesWorkbenchQuery, SalesWorkbenchData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sales: SalesWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: ReadSalesWorkbenchQuery): Promise<SalesWorkbenchData> {
        return this.sales.read(query.params.principal.id, query.params.request.workspaceId)
    }
}
