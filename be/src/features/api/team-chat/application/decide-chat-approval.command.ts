import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideOutcome, DecideRequest } from "./team-chat.contracts"

/** Settles the decision an approval card is about, as the person who clicked it. */
export class DecideChatApprovalCommand extends Command<DecideOutcome> {
    constructor(readonly params: ExecuteParams<DecideRequest>) {
        super()
    }
}
