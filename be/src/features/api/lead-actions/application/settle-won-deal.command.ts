import { Command } from "@nestjs/cqrs"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadActionRequest } from "./lead-action.contracts"

/** Queues the accounting handoff of a won deal. */
export class SettleWonDealCommand extends Command<LeadActionQueued> {
    constructor(readonly params: ExecuteParams<LeadActionRequest>) {
        super()
    }
}
