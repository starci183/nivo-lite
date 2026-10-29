import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ReactToLeadCapturedRequest } from "./react-to-lead-captured.contracts"

/** Asks to apply one delivered lead_captured event; the lead_captured consumer sends it for every delivery. */
export class ReactToLeadCapturedCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<ReactToLeadCapturedRequest>) {
        super()
    }
}
