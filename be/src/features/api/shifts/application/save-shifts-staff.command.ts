import { Command } from "@nestjs/cqrs"
import type { SaveStaffOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveShiftsStaffRequest } from "./save-shifts-staff.contracts"

/** Asks for create or update one person's shifts profile. */
export class SaveShiftsStaffCommand extends Command<SaveStaffOutput> {
    constructor(readonly params: ExecuteParams<SaveShiftsStaffRequest>) {
        super()
    }
}
