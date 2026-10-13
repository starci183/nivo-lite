import { QueryHandler } from "@nestjs/cqrs"
import { ShiftsWorkbenchService } from "@modules/domain/shifts"
import type { ShiftsBenchView } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ShiftsWorkbenchQuery } from "./shifts-workbench.query"

@QueryHandler(ShiftsWorkbenchQuery)
/** The whole shifts workbench of the caller's workspace for one week. */
export class ShiftsWorkbenchHandler extends ICQRSHandler<ShiftsWorkbenchQuery, ShiftsBenchView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: ShiftsWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: ShiftsWorkbenchQuery): Promise<ShiftsBenchView> {
        return this.workbench.bench(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.week,
        )
    }
}
