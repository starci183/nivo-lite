import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReactToDecisionMadeRequest } from "./react-to-decision-made.contracts"

/** Asks to apply one delivered decision_made event; the decision_made consumer sends it for every delivery. */
export class ReactToDecisionMadeCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ReactToDecisionMadeRequest>) {
        super()
    }
}
