import { Query } from "@nestjs/cqrs"
import type { DoorAnswer } from "@modules/domain/workbench-door"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { WorkbenchRequest } from "./workbench.contracts"

/** Asks the workbench door to run a read for the caller. */
export class WorkbenchReadQuery extends Query<DoorAnswer> {
    constructor(readonly params: ExecuteParams<WorkbenchRequest>) {
        super()
    }
}
