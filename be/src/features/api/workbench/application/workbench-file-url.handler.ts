import { QueryHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService, type DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkbenchFileUrlQuery } from "./workbench-file-url.query"

@QueryHandler(WorkbenchFileUrlQuery)
/** Signs a read address through the workbench door, which proves membership, the read's reach and its permission. */
export class WorkbenchFileUrlHandler extends ICQRSHandler<WorkbenchFileUrlQuery, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(query: WorkbenchFileUrlQuery): Promise<DoorAnswer> {
        return this.door.fileUrl(query.params.principal.id, query.params.request.call)
    }
}
