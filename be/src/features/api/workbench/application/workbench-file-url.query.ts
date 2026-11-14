import { Query } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchFileUrlRequest } from "./workbench.contracts"

/** Asks the workbench door for a short-lived signed read address of a record's file. */
export class WorkbenchFileUrlQuery extends Query<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchFileUrlRequest>) {
        super()
    }
}
