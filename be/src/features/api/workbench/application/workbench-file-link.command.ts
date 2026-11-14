import { Command } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchFileLinkRequest } from "./workbench.contracts"

/** Asks the workbench door to attach an uploaded file to a record's file field. */
export class WorkbenchFileLinkCommand extends Command<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchFileLinkRequest>) {
        super()
    }
}
