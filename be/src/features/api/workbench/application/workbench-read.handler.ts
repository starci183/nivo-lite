import { QueryHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService } from "@modules/domain/workbench-door"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { WorkbenchReadQuery } from "./workbench-read.query"

@QueryHandler(WorkbenchReadQuery)
/** Runs a read through the workbench door, which proves membership and permission. */
export class WorkbenchReadHandler extends ICQRSHandler<WorkbenchReadQuery, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(query: WorkbenchReadQuery): Promise<DoorAnswer> {
        return this.door.read(query.params.principal.id, query.params.request)
    }
}
