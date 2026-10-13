import { Command } from "@nestjs/cqrs"
import type { CheckInOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckInShiftsRequest } from "./check-in-shifts.contracts"

/** Asks for check in to the caller's shift. */
export class CheckInShiftsCommand extends Command<CheckInOutput> {
    constructor(readonly params: ExecuteParams<CheckInShiftsRequest>) {
        super()
    }
}
