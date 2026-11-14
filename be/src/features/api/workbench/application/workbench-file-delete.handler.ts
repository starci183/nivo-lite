import { CommandHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService, type DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkbenchFileDeleteCommand } from "./workbench-file-delete.command"

@CommandHandler(WorkbenchFileDeleteCommand)
/** Clears a record's file field and removes its file through the workbench door, which proves membership, the action's reach and its permission. */
export class WorkbenchFileDeleteHandler extends ICQRSHandler<WorkbenchFileDeleteCommand, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(command: WorkbenchFileDeleteCommand): Promise<DoorAnswer> {
        return this.door.fileDelete(command.params.principal.id, command.params.request.call)
    }
}
