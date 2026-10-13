import { Command } from "@nestjs/cqrs"
import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadActionRequest } from "./lead-action.contracts"

/** Creates a lead through the existing queued lead flow. */
export class CreateLeadCommand extends Command<LeadActionQueued> {
    constructor(readonly params: ExecuteParams<LeadActionRequest>) {
        super()
    }
}
