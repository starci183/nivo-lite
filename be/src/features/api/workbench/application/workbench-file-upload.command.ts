import { Command } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchFileUploadRequest } from "./workbench.contracts"

/** Asks the workbench door for a ticket to upload one file into a record's file field. */
export class WorkbenchFileUploadCommand extends Command<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchFileUploadRequest>) {
        super()
    }
}
