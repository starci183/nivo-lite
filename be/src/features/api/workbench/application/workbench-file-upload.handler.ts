import { CommandHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService, type DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkbenchFileUploadCommand } from "./workbench-file-upload.command"

@CommandHandler(WorkbenchFileUploadCommand)
/** Issues an upload ticket through the workbench door, which proves membership, the action's reach and its permission. */
export class WorkbenchFileUploadHandler extends ICQRSHandler<WorkbenchFileUploadCommand, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(command: WorkbenchFileUploadCommand): Promise<DoorAnswer> {
        return this.door.fileUpload(command.params.principal.id, command.params.request.call, command.params.request.facts)
    }
}
