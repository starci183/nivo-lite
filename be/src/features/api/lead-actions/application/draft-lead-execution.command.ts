import { Command } from "@nestjs/cqrs"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadActionRequest } from "./lead-action.contracts"

/** Queues a draft execution plan for the lead. */
export class DraftLeadExecutionCommand extends Command<LeadActionQueued> {
    constructor(readonly params: ExecuteParams<LeadActionRequest>) {
        super()
    }
}
