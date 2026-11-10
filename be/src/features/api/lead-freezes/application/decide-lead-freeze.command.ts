import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideLeadFreezeOutcome, DecideLeadFreezeRequest } from "./lead-freeze.contracts"

/** The owner's answer to a customer frozen by a failed run: retry, take over, or skip the turn. */
export class DecideLeadFreezeCommand extends Command<DecideLeadFreezeOutcome> {
    constructor(readonly params: ExecuteParams<DecideLeadFreezeRequest>) {
        super()
    }
}
