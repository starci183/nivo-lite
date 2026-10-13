import { Command } from "@nestjs/cqrs"
import type { ApplyImportOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ApplyShiftsImportRequest } from "./apply-shifts-import.contracts"

/** Asks for read the quick import text and set the shop up from it. */
export class ApplyShiftsImportCommand extends Command<ApplyImportOutput> {
    constructor(readonly params: ExecuteParams<ApplyShiftsImportRequest>) {
        super()
    }
}
