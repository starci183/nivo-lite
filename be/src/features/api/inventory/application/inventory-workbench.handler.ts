import { QueryHandler } from "@nestjs/cqrs"
import { InventoryWorkbenchService } from "@modules/domain/inventory"
import type { InventoryWorkbenchView } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryWorkbenchQuery } from "./inventory-workbench.query"

@QueryHandler(InventoryWorkbenchQuery)
/** The whole inventory workbench of the caller's workspace. */
export class InventoryWorkbenchHandler extends ICQRSHandler<InventoryWorkbenchQuery, InventoryWorkbenchView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: InventoryWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: InventoryWorkbenchQuery): Promise<InventoryWorkbenchView> {
        return this.workbench.workbench(query.params.principal.id, query.params.request.workspaceId)
    }
}
