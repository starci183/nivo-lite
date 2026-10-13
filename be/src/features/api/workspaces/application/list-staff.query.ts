import { Query } from "@nestjs/cqrs"
import type { StaffOption } from "@modules/domain/workspace-members"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListStaffRequest } from "./list-staff.contracts"

/** Asks for the active staff of the caller's workspace a member can be linked to. */
export class ListStaffQuery extends Query<ReadonlyArray<StaffOption>> {
    constructor(readonly params: ExecuteParams<ListStaffRequest>) {
        super()
    }
}
