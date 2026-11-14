import { Command } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchFileConfirmRequest } from "./workbench.contracts"

/** Asks the workbench door to prove an uploaded file and answer the reference to store. */
export class WorkbenchFileConfirmCommand extends Command<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchFileConfirmRequest>) {
        super()
    }
}
