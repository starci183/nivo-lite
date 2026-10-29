import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SettleApprovalOutcomeRequest } from "./settle-approval-outcome.contracts"

/** Asks to apply one delivered approval_resolved event; the approval_resolved consumer sends it for every delivery. */
export class SettleApprovalOutcomeCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SettleApprovalOutcomeRequest>) {
        super()
    }
}
