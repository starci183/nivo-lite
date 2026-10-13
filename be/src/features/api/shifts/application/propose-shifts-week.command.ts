import { Command } from "@nestjs/cqrs"
import type { ProposeWeekOutput } from "@modules/domain/shifts"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ProposeShiftsWeekRequest } from "./propose-shifts-week.contracts"

/** Asks for build a draft schedule for the week that contains a day. */
export class ProposeShiftsWeekCommand extends Command<ProposeWeekOutput> {
    constructor(readonly params: ExecuteParams<ProposeShiftsWeekRequest>) {
        super()
    }
}
