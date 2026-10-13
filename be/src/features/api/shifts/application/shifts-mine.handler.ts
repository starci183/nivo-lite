import { QueryHandler } from "@nestjs/cqrs"
import { ShiftsWorkbenchService } from "@modules/domain/shifts"
import type { ShiftsMineView } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ShiftsMineQuery } from "./shifts-mine.query"

@QueryHandler(ShiftsMineQuery)
/** The signed-in person's own shifts view. */
export class ShiftsMineHandler extends ICQRSHandler<ShiftsMineQuery, ShiftsMineView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: ShiftsWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: ShiftsMineQuery): Promise<ShiftsMineView> {
        return this.workbench.mine(query.params.principal.id, query.params.request.workspaceId)
    }
}
