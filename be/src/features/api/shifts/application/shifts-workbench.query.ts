import { Query } from "@nestjs/cqrs"
import type { ShiftsBenchView } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ShiftsWorkbenchRequest } from "./shifts-workbench.contracts"

/** Asks for the whole shifts workbench of the caller's workspace for one week. */
export class ShiftsWorkbenchQuery extends Query<ShiftsBenchView> {
    constructor(readonly params: ExecuteParams<ShiftsWorkbenchRequest>) {
        super()
    }
}
