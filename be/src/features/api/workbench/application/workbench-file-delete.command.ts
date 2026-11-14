import { Command } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchFileDeleteRequest } from "./workbench.contracts"

/** Asks the workbench door to clear a record's file field and remove its file. */
export class WorkbenchFileDeleteCommand extends Command<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchFileDeleteRequest>) {
        super()
    }
}
