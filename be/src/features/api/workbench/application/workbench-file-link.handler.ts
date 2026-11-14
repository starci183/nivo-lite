import { CommandHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService, type DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkbenchFileLinkCommand } from "./workbench-file-link.command"

@CommandHandler(WorkbenchFileLinkCommand)
/** Attaches an uploaded file through the workbench door, which proves membership, the action's reach and its permission. */
export class WorkbenchFileLinkHandler extends ICQRSHandler<WorkbenchFileLinkCommand, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(command: WorkbenchFileLinkCommand): Promise<DoorAnswer> {
        return this.door.fileLink(
            command.params.principal.id,
            command.params.request.call,
            command.params.request.key,
            command.params.request.name,
        )
    }
}
