import { Command } from "@nestjs/cqrs"
import type { ReassignShiftOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReassignShiftsShiftRequest } from "./reassign-shifts-shift.contracts"

/** Asks for give a draft shift to another person or open it. */
export class ReassignShiftsShiftCommand extends Command<ReassignShiftOutput> {
    constructor(readonly params: ExecuteParams<ReassignShiftsShiftRequest>) {
        super()
    }
}
