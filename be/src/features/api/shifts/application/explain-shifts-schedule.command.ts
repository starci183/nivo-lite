import { Command } from "@nestjs/cqrs"
import type { ExplainScheduleOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ExplainShiftsScheduleRequest } from "./explain-shifts-schedule.contracts"

/** Asks for write the explanation of a schedule again. */
export class ExplainShiftsScheduleCommand extends Command<ExplainScheduleOutput> {
    constructor(readonly params: ExecuteParams<ExplainShiftsScheduleRequest>) {
        super()
    }
}
