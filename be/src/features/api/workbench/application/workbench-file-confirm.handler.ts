import { CommandHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService, type DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkbenchFileConfirmCommand } from "./workbench-file-confirm.command"

@CommandHandler(WorkbenchFileConfirmCommand)
/** Confirms an uploaded file through the workbench door, which proves membership, the action's reach and its permission. */
export class WorkbenchFileConfirmHandler extends ICQRSHandler<WorkbenchFileConfirmCommand, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(command: WorkbenchFileConfirmCommand): Promise<DoorAnswer> {
        return this.door.fileConfirm(command.params.principal.id, command.params.request.call, command.params.request.key, command.params.request.name)
    }
}
