import { Command } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchRequest } from "./workbench.contracts"

/** Asks the workbench door to run an action for the caller. */
export class WorkbenchActionCommand extends Command<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchRequest>) {
        super()
    }
}
