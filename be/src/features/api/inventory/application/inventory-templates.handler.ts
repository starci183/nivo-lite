import { QueryHandler } from "@nestjs/cqrs"
import { InventoryWorkbenchService } from "@modules/domain/inventory"
import type { InventoryTemplateInfo } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryTemplatesQuery } from "./inventory-templates.query"

@QueryHandler(InventoryTemplatesQuery)
/** The starter sets a new shop can pick. */
export class InventoryTemplatesHandler extends ICQRSHandler<
    InventoryTemplatesQuery,
    ReadonlyArray<InventoryTemplateInfo>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: InventoryWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadonlyArray<InventoryTemplateInfo>> {
        return Promise.resolve(this.workbench.templates())
    }
}
