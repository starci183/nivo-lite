import { Command } from "@nestjs/cqrs"
import type { RequestOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestShiftsLeaveRequest } from "./request-shifts-leave.contracts"

/** Asks for ask for leave. */
export class RequestShiftsLeaveCommand extends Command<RequestOutput> {
    constructor(readonly params: ExecuteParams<RequestShiftsLeaveRequest>) {
        super()
    }
}
