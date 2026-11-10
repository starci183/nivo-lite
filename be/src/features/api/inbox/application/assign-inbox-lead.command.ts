import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AssignInboxLeadRequest } from "./assign-inbox-lead.contracts"

/** Asks to hand one customer to an agent. */
export class AssignInboxLeadCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<AssignInboxLeadRequest>) {
        super()
    }
}
