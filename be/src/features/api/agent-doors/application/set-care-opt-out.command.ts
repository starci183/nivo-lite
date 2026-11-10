import { Command } from "@nestjs/cqrs"
import type { CareOptOutAnswer } from "@modules/domain/agent-doors"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetCareOptOutRequest } from "./agent-doors.contracts"

/** Sets or clears a customer's care opt-out on the shop's word. */
export class SetCareOptOutCommand extends Command<CareOptOutAnswer> {
    constructor(readonly params: ExecuteParams<SetCareOptOutRequest>) {
        super()
    }
}
