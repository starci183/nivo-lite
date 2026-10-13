import { Command } from "@nestjs/cqrs"
import type { RequestOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestShiftsSwapRequest } from "./request-shifts-swap.contracts"

/** Asks for hand a shift over or take an open one. */
export class RequestShiftsSwapCommand extends Command<RequestOutput> {
    constructor(readonly params: ExecuteParams<RequestShiftsSwapRequest>) {
        super()
    }
}
