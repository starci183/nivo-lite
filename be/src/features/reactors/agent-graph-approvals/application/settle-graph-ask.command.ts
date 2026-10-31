import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SettleGraphAskRequest } from "./settle-graph-ask.contracts"

/** Asks to settle the ask of a branch that one delivered approval_resolved event ended; the consumer sends it for every delivery. */
export class SettleGraphAskCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SettleGraphAskRequest>) {
        super()
    }
}
