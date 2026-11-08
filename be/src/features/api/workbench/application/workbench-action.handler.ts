import { CommandHandler } from "@nestjs/cqrs"
import { WorkbenchDoorService, type DoorAnswer } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WorkbenchActionCommand } from "./workbench-action.command"

@CommandHandler(WorkbenchActionCommand)
/** Runs an action through the workbench door, which proves membership, permission and the authority rules. */
export class WorkbenchActionHandler extends ICQRSHandler<WorkbenchActionCommand, DoorAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: WorkbenchDoorService,
    ) {
        super(logger)
    }

    protected override process(command: WorkbenchActionCommand): Promise<DoorAnswer> {
        return this.door.act(command.params.principal.id, command.params.request)
    }
}
