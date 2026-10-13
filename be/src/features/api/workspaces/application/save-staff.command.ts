import { Command } from "@nestjs/cqrs"
import type { StaffOption } from "@modules/domain/workspace-members"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveStaffRequest } from "./save-staff.contracts"

/** Asks to add or update a staff row. */
export class SaveStaffCommand extends Command<StaffOption> {
    constructor(readonly params: ExecuteParams<SaveStaffRequest>) {
        super()
    }
}
