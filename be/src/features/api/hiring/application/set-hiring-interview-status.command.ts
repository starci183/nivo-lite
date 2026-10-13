import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetHiringInterviewStatusRequest } from "./set-hiring-interview-status.contracts"

/** Asks for mark an interview done, cancelled or missed. */
export class SetHiringInterviewStatusCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetHiringInterviewStatusRequest>) {
        super()
    }
}
